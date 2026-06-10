import { Injectable, inject, signal } from '@angular/core';

import {
  collectAuditMediaPaths,
  collectDraftMediaPaths,
} from './account-media-cleanup.utils';
import { validateDrawdownHierarchy } from './drawdown-limits.utils';
import type { TradingAccount, TradingAccountType } from '../models/database.types';
import { SupabaseService } from '../supabase/supabase.service';

export interface TradingAccountSettingsInput {
  name: string;
  starting_capital: number;
  daily_drawdown_pct: number;
  weekly_drawdown_pct: number;
  max_drawdown_pct: number;
  currency?: string;
}

const ACCOUNT_SELECT =
  'id, user_id, name, account_type, currency, starting_capital, current_balance, daily_drawdown_pct, weekly_drawdown_pct, max_drawdown_pct, configured_at, created_at, updated_at';

@Injectable({ providedIn: 'root' })
export class TradingAccountService {
  private readonly supabase = inject(SupabaseService);

  private readonly accountsCache = signal<TradingAccount[]>([]);
  private readonly activeAccount = signal<TradingAccount | null>(null);

  readonly accounts = this.accountsCache.asReadonly();
  readonly active = this.activeAccount.asReadonly();

  isConfigured(account: TradingAccount): boolean {
    return account.configured_at != null;
  }

  async loadAccounts(): Promise<TradingAccount[]> {
    const {
      data: { user },
    } = await this.supabase.client.auth.getUser();
    if (!user) {
      this.accountsCache.set([]);
      return [];
    }

    const { data, error } = await this.supabase.client
      .from('trading_accounts')
      .select(ACCOUNT_SELECT)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []) as TradingAccount[];
    this.accountsCache.set(rows);
    return rows;
  }

  async getAccount(accountId: string): Promise<TradingAccount | null> {
    const {
      data: { user },
    } = await this.supabase.client.auth.getUser();
    if (!user) {
      return null;
    }

    const { data, error } = await this.supabase.client
      .from('trading_accounts')
      .select(ACCOUNT_SELECT)
      .eq('id', accountId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    const account = (data as TradingAccount | null) ?? null;
    if (account) {
      this.activeAccount.set(account);
      this.upsertCache(account);
    }
    return account;
  }

  async createAccount(name: string, accountType: TradingAccountType): Promise<TradingAccount> {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      throw new Error('Account name must be at least 2 characters.');
    }

    const {
      data: { user },
    } = await this.supabase.client.auth.getUser();
    if (!user) {
      throw new Error('Sign in to create an account.');
    }

    const { data, error } = await this.supabase.client
      .from('trading_accounts')
      .insert({
        user_id: user.id,
        name: trimmed,
        account_type: accountType,
      })
      .select(ACCOUNT_SELECT)
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Could not create account.');
    }

    const account = data as TradingAccount;
    this.accountsCache.update((list) => [account, ...list]);
    return account;
  }

  async updateSettings(accountId: string, input: TradingAccountSettingsInput): Promise<TradingAccount> {
    const {
      data: { user },
    } = await this.supabase.client.auth.getUser();
    if (!user) {
      throw new Error('Sign in to save settings.');
    }

    if (input.starting_capital <= 0) {
      throw new Error('Starting capital must be greater than zero.');
    }
    const hierarchyError = validateDrawdownHierarchy({
      daily_drawdown_pct: input.daily_drawdown_pct,
      weekly_drawdown_pct: input.weekly_drawdown_pct,
      max_drawdown_pct: input.max_drawdown_pct,
    });
    if (hierarchyError) {
      throw new Error(hierarchyError);
    }

    const existing = await this.getAccount(accountId);
    const configuredAt = existing?.configured_at ?? new Date().toISOString();
    const isFirstConfigure = !existing?.configured_at;

    const updatePayload: Record<string, unknown> = {
      name: input.name.trim(),
      currency: input.currency ?? 'USD',
      starting_capital: input.starting_capital,
      daily_drawdown_pct: input.daily_drawdown_pct,
      weekly_drawdown_pct: input.weekly_drawdown_pct,
      max_drawdown_pct: input.max_drawdown_pct,
      configured_at: configuredAt,
    };

    if (isFirstConfigure) {
      updatePayload['current_balance'] = input.starting_capital;
    }

    const { data, error } = await this.supabase.client
      .from('trading_accounts')
      .update(updatePayload)
      .eq('id', accountId)
      .eq('user_id', user.id)
      .select(ACCOUNT_SELECT)
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Could not save settings.');
    }

    if (!isFirstConfigure) {
      await this.recalculateBalance(accountId);
    }

    const account = (await this.getAccount(accountId)) ?? (data as TradingAccount);
    return account;
  }

  async recalculateBalance(accountId: string): Promise<void> {
    const account = await this.getAccount(accountId);
    if (!account?.configured_at || account.starting_capital == null) {
      return;
    }

    const { data, error } = await this.supabase.client
      .from('trades')
      .select('net_profit')
      .eq('account_id', accountId)
      .eq('status', 'CLOSED');

    if (error) {
      throw new Error(error.message);
    }

    const profitSum = (data ?? []).reduce((sum, row) => sum + (Number(row.net_profit) || 0), 0);
    const balance = Number(account.starting_capital) + profitSum;

    const { data: updated, error: updateError } = await this.supabase.client
      .from('trading_accounts')
      .update({ current_balance: balance })
      .eq('id', accountId)
      .select(ACCOUNT_SELECT)
      .single();

    if (updateError || !updated) {
      throw new Error(updateError?.message ?? 'Could not update balance.');
    }

    const next = updated as TradingAccount;
    this.activeAccount.set(next);
    this.upsertCache(next);
  }

  async deleteAccount(accountId: string): Promise<void> {
    const {
      data: { user },
    } = await this.supabase.client.auth.getUser();
    if (!user) {
      throw new Error('Sign in to delete an account.');
    }

    const account = await this.getAccount(accountId);
    if (!account) {
      throw new Error('Account not found.');
    }

    const { data: drafts, error: draftsError } = await this.supabase.client
      .from('gatekeeper_drafts')
      .select('media')
      .eq('account_id', accountId)
      .eq('user_id', user.id);

    if (draftsError) {
      throw new Error(draftsError.message);
    }

    const { data: trades, error: tradesError } = await this.supabase.client
      .from('trades')
      .select('id')
      .eq('account_id', accountId)
      .eq('user_id', user.id);

    if (tradesError) {
      throw new Error(tradesError.message);
    }

    const tradeIds = (trades ?? []).map((row) => row.id);
    const storagePaths = new Set<string>();

    for (const draft of drafts ?? []) {
      for (const path of collectDraftMediaPaths(draft.media)) {
        storagePaths.add(path);
      }
    }

    if (tradeIds.length > 0) {
      const { data: audits, error: auditsError } = await this.supabase.client
        .from('execution_audits')
        .select('htf_context, pillar_journals')
        .in('trade_id', tradeIds);

      if (auditsError) {
        throw new Error(auditsError.message);
      }

      for (const audit of audits ?? []) {
        for (const path of collectAuditMediaPaths(audit.htf_context, audit.pillar_journals)) {
          storagePaths.add(path);
        }
      }
    }

    const { error: deleteError } = await this.supabase.client
      .from('trading_accounts')
      .delete()
      .eq('id', accountId)
      .eq('user_id', user.id);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    if (storagePaths.size > 0) {
      const { error: storageError } = await this.supabase.client.storage
        .from('trade-screenshots')
        .remove([...storagePaths]);
      if (storageError) {
        console.warn('[accounts] Could not remove all screenshots', storageError.message);
      }
    }

    this.accountsCache.update((list) => list.filter((row) => row.id !== accountId));
    if (this.activeAccount()?.id === accountId) {
      this.activeAccount.set(null);
    }
  }

  setActiveAccount(account: TradingAccount | null): void {
    this.activeAccount.set(account);
  }

  private upsertCache(account: TradingAccount): void {
    this.accountsCache.update((list) => {
      const idx = list.findIndex((a) => a.id === account.id);
      if (idx < 0) {
        return [account, ...list];
      }
      const copy = [...list];
      copy[idx] = account;
      return copy;
    });
  }
}
