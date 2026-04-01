module pulse_market::pulse_market {
    use std::signer;
    use std::string::{Self, String};
    use std::vector;

    use minitia_std::coin;
    use minitia_std::event;
    use minitia_std::fungible_asset::Metadata;
    use minitia_std::object::{Self, ExtendRef, Object};
    use minitia_std::primary_fungible_store;
    use minitia_std::simple_map;
    use minitia_std::table;
    use minitia_std::timestamp;

    const STATUS_OPEN: u8 = 0;
    const STATUS_CLOSED: u8 = 1;
    const STATUS_RESOLVED: u8 = 2;

    const OUTCOME_UNRESOLVED: u8 = 0;
    const OUTCOME_YES: u8 = 1;
    const OUTCOME_NO: u8 = 2;

    const MAX_FEE_BPS: u64 = 1000;
    const CREATE_MARKET_FEE: u64 = 100_000;

    const E_NOT_ORACLE: u64 = 1;
    const E_MARKET_NOT_OPEN: u64 = 2;
    const E_BETTING_CLOSED: u64 = 3;
    const E_ZERO_AMOUNT: u64 = 4;
    const E_MARKET_NOT_CLOSED: u64 = 5;
    const E_TOO_EARLY_TO_RESOLVE: u64 = 6;
    const E_MARKET_NOT_RESOLVED: u64 = 7;
    const E_NOT_WINNER: u64 = 8;
    const E_ALREADY_CLAIMED: u64 = 9;
    const E_FEE_TOO_HIGH: u64 = 10;
    const E_USE_CLAIM_REFUND: u64 = 11;
    const E_CLOSE_TIME_PAST: u64 = 12;
    const E_RESOLVE_BEFORE_CLOSE: u64 = 13;
    const E_NOT_REFUND_ELIGIBLE: u64 = 14;

    const NATIVE_SYMBOL: vector<u8> = b"umin";
    const VAULT_SEED: vector<u8> = b"pulse_market_vault";

    struct Market has store {
        id: u64,
        question: String,
        category: String,
        close_time: u64,
        resolve_time: u64,
        status: u8,
        outcome: u8,
        total_yes_amount: u64,
        total_no_amount: u64,
        created_at: u64,
    }

    struct Position has copy, drop, store {
        yes_amount: u64,
        no_amount: u64,
        claimed: bool,
    }

    struct MarketStore has key {
        markets: table::Table<u64, Market>,
        positions: table::Table<u64, simple_map::SimpleMap<address, Position>>,
        fee_charged: table::Table<u64, bool>,
        market_count: u64,
        oracle: address,
        fee_bps: u64,
        fee_recipient: address,
        vault_owner: address,
        vault_extend_ref: ExtendRef,
        vault_balance: u64,
        fee_collected_total: u64,
    }

    #[event]
    struct MarketCreatedEvent has drop, store {
        market_id: u64,
        question: String,
        close_time: u64,
    }

    #[event]
    struct BetPlacedEvent has drop, store {
        market_id: u64,
        user: address,
        bet_yes: bool,
        amount: u64,
    }

    #[event]
    struct MarketClosedEvent has drop, store {
        market_id: u64,
    }

    #[event]
    struct MarketResolvedEvent has drop, store {
        market_id: u64,
        yes_won: bool,
    }

    #[event]
    struct WinningsClaimedEvent has drop, store {
        market_id: u64,
        user: address,
        payout: u64,
    }

    fun init_module(publisher: &signer) {
        let publisher_addr = signer::address_of(publisher);
        let vault_constructor = object::create_named_object(publisher, VAULT_SEED);
        let vault_owner = object::address_from_constructor_ref(&vault_constructor);
        let vault_extend_ref = object::generate_extend_ref(&vault_constructor);
        move_to(
            publisher,
            MarketStore {
                markets: table::new(),
                positions: table::new(),
                fee_charged: table::new(),
                market_count: 0,
                oracle: publisher_addr,
                fee_bps: 200,
                fee_recipient: publisher_addr,
                vault_owner,
                vault_extend_ref,
                vault_balance: 0,
                fee_collected_total: 0,
            },
        );
    }

    public entry fun create_market(
        creator: &signer,
        question: String,
        category: String,
        close_time: u64,
        resolve_time: u64,
    ) acquires MarketStore {
        let store = borrow_global_mut<MarketStore>(@pulse_market);
        if (CREATE_MARKET_FEE > 0) {
            primary_fungible_store::transfer(
                creator,
                native_metadata(),
                store.fee_recipient,
                CREATE_MARKET_FEE,
            );
        };

        let now = timestamp::now_seconds();
        assert!(close_time > now, E_CLOSE_TIME_PAST);
        assert!(resolve_time >= close_time, E_RESOLVE_BEFORE_CLOSE);

        let market_id = store.market_count;
        table::add(
            &mut store.markets,
            market_id,
            Market {
                id: market_id,
                question,
                category,
                close_time,
                resolve_time,
                status: STATUS_OPEN,
                outcome: OUTCOME_UNRESOLVED,
                total_yes_amount: 0,
                total_no_amount: 0,
                created_at: now,
            },
        );
        table::add(&mut store.positions, market_id, simple_map::new());
        table::add(&mut store.fee_charged, market_id, false);
        store.market_count = market_id + 1;

        event::emit(MarketCreatedEvent {
            market_id,
            question: table::borrow(&store.markets, market_id).question,
            close_time,
        });
    }

    public entry fun place_bet(
        user: &signer,
        market_id: u64,
        bet_yes: bool,
        amount: u64,
    ) acquires MarketStore {
        assert!(amount > 0, E_ZERO_AMOUNT);

        let store = borrow_global_mut<MarketStore>(@pulse_market);
        assert!(table::contains(&store.markets, market_id), E_MARKET_NOT_OPEN);

        let market = table::borrow_mut(&mut store.markets, market_id);
        assert!(market.status == STATUS_OPEN, E_MARKET_NOT_OPEN);
        assert!(timestamp::now_seconds() < market.close_time, E_BETTING_CLOSED);

        primary_fungible_store::transfer(user, native_metadata(), store.vault_owner, amount);
        store.vault_balance = store.vault_balance + amount;

        let user_addr = signer::address_of(user);
        let positions = table::borrow_mut(&mut store.positions, market_id);
        if (simple_map::contains_key(positions, &user_addr)) {
            let pos = simple_map::borrow_mut(positions, &user_addr);
            if (bet_yes) {
                pos.yes_amount = pos.yes_amount + amount;
                market.total_yes_amount = market.total_yes_amount + amount;
            } else {
                pos.no_amount = pos.no_amount + amount;
                market.total_no_amount = market.total_no_amount + amount;
            };
        } else {
            let yes_amount = if (bet_yes) amount else 0;
            let no_amount = if (bet_yes) 0 else amount;
            simple_map::add(
                positions,
                user_addr,
                Position {
                    yes_amount,
                    no_amount,
                    claimed: false,
                },
            );
            if (bet_yes) {
                market.total_yes_amount = market.total_yes_amount + amount;
            } else {
                market.total_no_amount = market.total_no_amount + amount;
            };
        };

        event::emit(BetPlacedEvent {
            market_id,
            user: user_addr,
            bet_yes,
            amount,
        });
    }

    public entry fun close_market(caller: &signer, market_id: u64) acquires MarketStore {
        let _caller_addr = signer::address_of(caller);
        let store = borrow_global_mut<MarketStore>(@pulse_market);
        assert!(table::contains(&store.markets, market_id), E_MARKET_NOT_OPEN);

        let market = table::borrow_mut(&mut store.markets, market_id);
        assert!(market.status == STATUS_OPEN, E_MARKET_NOT_OPEN);
        assert!(timestamp::now_seconds() >= market.close_time, E_BETTING_CLOSED);

        market.status = STATUS_CLOSED;
        event::emit(MarketClosedEvent { market_id });
    }

    public entry fun resolve_market(
        oracle: &signer,
        market_id: u64,
        yes_won: bool,
    ) acquires MarketStore {
        let store = borrow_global_mut<MarketStore>(@pulse_market);
        assert!(signer::address_of(oracle) == store.oracle, E_NOT_ORACLE);
        assert!(table::contains(&store.markets, market_id), E_MARKET_NOT_CLOSED);

        let market = table::borrow_mut(&mut store.markets, market_id);
        assert!(market.status == STATUS_CLOSED, E_MARKET_NOT_CLOSED);
        assert!(timestamp::now_seconds() >= market.resolve_time, E_TOO_EARLY_TO_RESOLVE);

        market.outcome = if (yes_won) OUTCOME_YES else OUTCOME_NO;
        market.status = STATUS_RESOLVED;

        event::emit(MarketResolvedEvent { market_id, yes_won });
    }

    public entry fun claim_winnings(user: &signer, market_id: u64) acquires MarketStore {
        let user_addr = signer::address_of(user);
        let store = borrow_global_mut<MarketStore>(@pulse_market);
        assert!(table::contains(&store.markets, market_id), E_MARKET_NOT_RESOLVED);

        let market = table::borrow_mut(&mut store.markets, market_id);
        assert!(market.status == STATUS_RESOLVED, E_MARKET_NOT_RESOLVED);

        let positions_view = table::borrow(&store.positions, market_id);
        assert!(simple_map::contains_key(positions_view, &user_addr), E_NOT_WINNER);
        let position_view = simple_map::borrow(positions_view, &user_addr);
        assert!(!position_view.claimed, E_ALREADY_CLAIMED);

        let user_winning_amount = if (market.outcome == OUTCOME_YES) {
            position_view.yes_amount
        } else {
            position_view.no_amount
        };
        let total_winning_side = if (market.outcome == OUTCOME_YES) {
            market.total_yes_amount
        } else {
            market.total_no_amount
        };
        let losing_side_total = if (market.outcome == OUTCOME_YES) {
            market.total_no_amount
        } else {
            market.total_yes_amount
        };

        assert!(user_winning_amount > 0, E_NOT_WINNER);
        assert!(total_winning_side > 0, E_NOT_WINNER);
        assert!(losing_side_total > 0, E_USE_CLAIM_REFUND);

        let total_pool = market.total_yes_amount + market.total_no_amount;
        maybe_collect_fee(store, market_id, total_pool);

        let fee_amount = total_pool * store.fee_bps / 10000;
        let net_pool = total_pool - fee_amount;
        let payout = net_pool * user_winning_amount / total_winning_side;

        assert!(store.vault_balance >= payout, E_NOT_WINNER);
        store.vault_balance = store.vault_balance - payout;
        let vault_signer = object::generate_signer_for_extending(&store.vault_extend_ref);
        primary_fungible_store::transfer(&vault_signer, native_metadata(), user_addr, payout);

        let positions = table::borrow_mut(&mut store.positions, market_id);
        let position = simple_map::borrow_mut(positions, &user_addr);
        assert!(!position.claimed, E_ALREADY_CLAIMED);
        position.claimed = true;
        event::emit(WinningsClaimedEvent {
            market_id,
            user: user_addr,
            payout,
        });
    }

    public entry fun claim_refund(user: &signer, market_id: u64) acquires MarketStore {
        let user_addr = signer::address_of(user);
        let store = borrow_global_mut<MarketStore>(@pulse_market);
        assert!(table::contains(&store.markets, market_id), E_MARKET_NOT_RESOLVED);

        let market = table::borrow_mut(&mut store.markets, market_id);
        assert!(market.status == STATUS_RESOLVED, E_MARKET_NOT_RESOLVED);

        let winning_side_total = if (market.outcome == OUTCOME_YES) {
            market.total_yes_amount
        } else {
            market.total_no_amount
        };
        assert!(winning_side_total == 0, E_NOT_REFUND_ELIGIBLE);

        let positions = table::borrow_mut(&mut store.positions, market_id);
        assert!(simple_map::contains_key(positions, &user_addr), E_NOT_WINNER);
        let position = simple_map::borrow_mut(positions, &user_addr);
        assert!(!position.claimed, E_ALREADY_CLAIMED);

        let refund_amount = position.yes_amount + position.no_amount;
        assert!(refund_amount > 0, E_ZERO_AMOUNT);
        assert!(store.vault_balance >= refund_amount, E_NOT_WINNER);
        store.vault_balance = store.vault_balance - refund_amount;
        let vault_signer = object::generate_signer_for_extending(&store.vault_extend_ref);
        primary_fungible_store::transfer(
            &vault_signer,
            native_metadata(),
            user_addr,
            refund_amount,
        );

        position.claimed = true;
    }

    public entry fun set_oracle(admin: &signer, new_oracle: address) acquires MarketStore {
        let store = borrow_global_mut<MarketStore>(@pulse_market);
        assert!(signer::address_of(admin) == store.oracle, E_NOT_ORACLE);
        store.oracle = new_oracle;
    }

    public entry fun set_fee_bps(admin: &signer, new_fee_bps: u64) acquires MarketStore {
        let store = borrow_global_mut<MarketStore>(@pulse_market);
        assert!(signer::address_of(admin) == store.oracle, E_NOT_ORACLE);
        assert!(new_fee_bps <= MAX_FEE_BPS, E_FEE_TOO_HIGH);
        store.fee_bps = new_fee_bps;
    }

    public entry fun set_fee_recipient(admin: &signer, new_recipient: address) acquires MarketStore {
        let store = borrow_global_mut<MarketStore>(@pulse_market);
        assert!(signer::address_of(admin) == store.oracle, E_NOT_ORACLE);
        store.fee_recipient = new_recipient;
    }

    #[view]
    public fun get_market(
        market_id: u64,
    ): (u64, String, String, u64, u64, u8, u8, u64, u64, u64) acquires MarketStore {
        let store = borrow_global<MarketStore>(@pulse_market);
        let market = table::borrow(&store.markets, market_id);
        (
            market.id,
            market.question,
            market.category,
            market.close_time,
            market.resolve_time,
            market.status,
            market.outcome,
            market.total_yes_amount,
            market.total_no_amount,
            market.created_at,
        )
    }

    #[view]
    public fun get_user_position(market_id: u64, user: address): (u64, u64, bool) acquires MarketStore {
        let store = borrow_global<MarketStore>(@pulse_market);
        if (!table::contains(&store.positions, market_id)) {
            return (0, 0, false)
        };

        let positions = table::borrow(&store.positions, market_id);
        if (!simple_map::contains_key(positions, &user)) {
            (0, 0, false)
        } else {
            let position = simple_map::borrow(positions, &user);
            (position.yes_amount, position.no_amount, position.claimed)
        }
    }

    #[view]
    public fun get_market_count(): u64 acquires MarketStore {
        borrow_global<MarketStore>(@pulse_market).market_count
    }

    #[view]
    public fun get_oracle(): address acquires MarketStore {
        borrow_global<MarketStore>(@pulse_market).oracle
    }

    #[view]
    public fun get_creation_fee(): u64 {
        CREATE_MARKET_FEE
    }

    #[view]
    public fun get_active_market_ids(): vector<u64> acquires MarketStore {
        let store = borrow_global<MarketStore>(@pulse_market);
        let ids = vector::empty<u64>();
        let i = 0;
        while (i < store.market_count) {
            if (table::contains(&store.markets, i)) {
                let market = table::borrow(&store.markets, i);
                if (market.status == STATUS_OPEN) {
                    vector::push_back(&mut ids, i);
                };
            };
            i = i + 1;
        };
        ids
    }

    #[view]
    public fun get_vault_balance(): u64 acquires MarketStore {
        borrow_global<MarketStore>(@pulse_market).vault_balance
    }

    #[view]
    public fun get_fee_collected_total(): u64 acquires MarketStore {
        borrow_global<MarketStore>(@pulse_market).fee_collected_total
    }

    #[view]
    public fun get_vault_owner(): address acquires MarketStore {
        borrow_global<MarketStore>(@pulse_market).vault_owner
    }

    fun native_metadata(): Object<Metadata> {
        coin::metadata(@minitia_std, string::utf8(NATIVE_SYMBOL))
    }

    fun maybe_collect_fee(store: &mut MarketStore, market_id: u64, total_pool: u64) {
        let charged = table::borrow_mut(&mut store.fee_charged, market_id);
        if (!*charged) {
            let fee_amount = total_pool * store.fee_bps / 10000;
            assert!(store.vault_balance >= fee_amount, E_NOT_WINNER);
            store.vault_balance = store.vault_balance - fee_amount;
            store.fee_collected_total = store.fee_collected_total + fee_amount;
            if (fee_amount > 0) {
                let vault_signer =
                    object::generate_signer_for_extending(&store.vault_extend_ref);
                primary_fungible_store::transfer(
                    &vault_signer,
                    native_metadata(),
                    store.fee_recipient,
                    fee_amount,
                );
            };
            *charged = true;
        };
    }

    #[test_only]
    use minitia_std::account;
    #[test_only]
    use minitia_std::managed_coin;
    #[test_only]
    use minitia_std::option;

    #[test_only]
    public fun init_for_test(publisher: &signer) {
        let publisher_addr = signer::address_of(publisher);
        if (!exists<MarketStore>(publisher_addr)) {
            init_module(publisher);
        };
    }

    #[test_only]
    fun ensure_native_coin_for_test() {
        if (!coin::is_coin_by_symbol(@minitia_std, string::utf8(NATIVE_SYMBOL))) {
            let chain = account::create_signer_for_test(@minitia_std);
            managed_coin::initialize(
                &chain,
                option::none(),
                string::utf8(b"Mini Native"),
                string::utf8(NATIVE_SYMBOL),
                6,
                string::utf8(b""),
                string::utf8(b""),
            );
        };
    }

    #[test_only]
    public fun mint_native_for_test(recipient: address, amount: u64) {
        ensure_native_coin_for_test();
        let chain = account::create_signer_for_test(@minitia_std);
        managed_coin::mint_to(&chain, recipient, native_metadata(), amount);
    }
}
