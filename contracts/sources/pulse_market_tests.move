#[test_only]
module pulse_market::pulse_market_tests {
    use std::signer;
    use std::string;

    use minitia_std::coin;
    use minitia_std::timestamp;

    use pulse_market::pulse_market;

    const BASE_TIME: u64 = 1000;

    fun setup(publisher: &signer) {
        timestamp::set_time_has_started_for_testing(publisher);
        timestamp::update_global_time_for_test_secs(BASE_TIME);
        pulse_market::init_for_test(publisher);
        fund(signer::address_of(publisher));
    }

    fun fund(addr: address) {
        pulse_market::mint_native_for_test(addr, 5_000_000);
    }

    #[test(publisher = @pulse_market, user_a = @0xa11ce, user_b = @0xb0b, user_c = @0xca11)]
    fun test_happy_path_yes_wins(
        publisher: signer,
        user_a: signer,
        user_b: signer,
        user_c: signer,
    ) {
        setup(&publisher);
        fund(signer::address_of(&user_a));
        fund(signer::address_of(&user_b));
        fund(signer::address_of(&user_c));

        let close_time = BASE_TIME + 10;
        let resolve_time = BASE_TIME + 20;
        pulse_market::create_market(
            &publisher,
            string::utf8(b"BTC above 100k?"),
            string::utf8(b"crypto"),
            close_time,
            resolve_time,
        );

        pulse_market::place_bet(&user_a, 0, true, 1000);
        pulse_market::place_bet(&user_b, 0, true, 500);
        pulse_market::place_bet(&user_c, 0, false, 500);

        timestamp::update_global_time_for_test_secs(close_time + 1);
        pulse_market::close_market(&user_a, 0);

        timestamp::update_global_time_for_test_secs(resolve_time + 1);
        pulse_market::resolve_market(&publisher, 0, true);

        pulse_market::claim_winnings(&user_a, 0);
        pulse_market::claim_winnings(&user_b, 0);

        assert!(pulse_market::get_vault_balance() == 1, 1);
        assert!(pulse_market::get_fee_collected_total() == 40, 2);

        let (_, _, claimed_a) = pulse_market::get_user_position(0, signer::address_of(&user_a));
        let (_, _, claimed_b) = pulse_market::get_user_position(0, signer::address_of(&user_b));
        assert!(claimed_a, 3);
        assert!(claimed_b, 4);
    }

    #[test(publisher = @pulse_market, user_a = @0xaa, user_b = @0xbb, user_c = @0xcc)]
    fun test_happy_path_no_wins(
        publisher: signer,
        user_a: signer,
        user_b: signer,
        user_c: signer,
    ) {
        setup(&publisher);
        fund(signer::address_of(&user_a));
        fund(signer::address_of(&user_b));
        fund(signer::address_of(&user_c));

        let close_time = BASE_TIME + 10;
        let resolve_time = BASE_TIME + 20;
        pulse_market::create_market(
            &publisher,
            string::utf8(b"Team A wins?"),
            string::utf8(b"sports"),
            close_time,
            resolve_time,
        );

        pulse_market::place_bet(&user_a, 0, true, 1000);
        pulse_market::place_bet(&user_b, 0, false, 600);
        pulse_market::place_bet(&user_c, 0, false, 400);

        timestamp::update_global_time_for_test_secs(close_time + 1);
        pulse_market::close_market(&user_b, 0);

        timestamp::update_global_time_for_test_secs(resolve_time + 1);
        pulse_market::resolve_market(&publisher, 0, false);

        pulse_market::claim_winnings(&user_b, 0);
        pulse_market::claim_winnings(&user_c, 0);

        let (yes_amt, no_amt, claimed_b) =
            pulse_market::get_user_position(0, signer::address_of(&user_b));
        assert!(yes_amt == 0, 10);
        assert!(no_amt == 600, 11);
        assert!(claimed_b, 12);
        assert!(pulse_market::get_fee_collected_total() == 40, 13);
    }

    #[test(publisher = @pulse_market, user_a = @0x1)]
    #[expected_failure]
    fun test_cannot_bet_after_close(publisher: signer, user_a: signer) {
        setup(&publisher);
        fund(signer::address_of(&user_a));

        let close_time = BASE_TIME + 5;
        let resolve_time = BASE_TIME + 10;
        pulse_market::create_market(
            &publisher,
            string::utf8(b"Late bet test"),
            string::utf8(b"news"),
            close_time,
            resolve_time,
        );

        timestamp::update_global_time_for_test_secs(close_time + 1);
        pulse_market::place_bet(&user_a, 0, true, 100);
    }

    #[test(publisher = @pulse_market, user_a = @0x11, user_b = @0x12)]
    #[expected_failure]
    fun test_cannot_resolve_before_time(
        publisher: signer,
        user_a: signer,
        user_b: signer,
    ) {
        setup(&publisher);
        fund(signer::address_of(&user_a));

        let close_time = BASE_TIME + 5;
        let resolve_time = BASE_TIME + 100;
        pulse_market::create_market(
            &publisher,
            string::utf8(b"Resolve too early"),
            string::utf8(b"sports"),
            close_time,
            resolve_time,
        );
        pulse_market::place_bet(&user_a, 0, true, 100);

        timestamp::update_global_time_for_test_secs(close_time + 1);
        pulse_market::close_market(&user_b, 0);
        pulse_market::resolve_market(&publisher, 0, true);
    }

    #[test(publisher = @pulse_market, user_a = @0x21, user_b = @0x22)]
    #[expected_failure]
    fun test_cannot_claim_twice(
        publisher: signer,
        user_a: signer,
        user_b: signer,
    ) {
        setup(&publisher);
        fund(signer::address_of(&user_a));
        fund(signer::address_of(&user_b));

        let close_time = BASE_TIME + 5;
        let resolve_time = BASE_TIME + 8;
        pulse_market::create_market(
            &publisher,
            string::utf8(b"Double claim"),
            string::utf8(b"crypto"),
            close_time,
            resolve_time,
        );

        pulse_market::place_bet(&user_a, 0, true, 300);
        pulse_market::place_bet(&user_b, 0, false, 100);

        timestamp::update_global_time_for_test_secs(close_time + 1);
        pulse_market::close_market(&user_b, 0);

        timestamp::update_global_time_for_test_secs(resolve_time + 1);
        pulse_market::resolve_market(&publisher, 0, true);

        pulse_market::claim_winnings(&user_a, 0);
        pulse_market::claim_winnings(&user_a, 0);
    }

    #[test(publisher = @pulse_market, user_a = @0x31, user_b = @0x32)]
    fun test_zero_winning_side_refund(
        publisher: signer,
        user_a: signer,
        user_b: signer,
    ) {
        setup(&publisher);
        fund(signer::address_of(&user_a));

        let close_time = BASE_TIME + 5;
        let resolve_time = BASE_TIME + 8;
        pulse_market::create_market(
            &publisher,
            string::utf8(b"Refund path"),
            string::utf8(b"news"),
            close_time,
            resolve_time,
        );

        pulse_market::place_bet(&user_a, 0, true, 700);

        timestamp::update_global_time_for_test_secs(close_time + 1);
        pulse_market::close_market(&user_b, 0);

        timestamp::update_global_time_for_test_secs(resolve_time + 1);
        pulse_market::resolve_market(&publisher, 0, false);

        pulse_market::claim_refund(&user_a, 0);

        let (_, _, claimed_a) = pulse_market::get_user_position(0, signer::address_of(&user_a));
        assert!(claimed_a, 21);
        assert!(pulse_market::get_vault_balance() == 0, 22);
    }

    #[test(publisher = @pulse_market, attacker = @0x44)]
    fun test_permissionless_market_creation(publisher: signer, attacker: signer) {
        setup(&publisher);
        fund(signer::address_of(&attacker));
        pulse_market::create_market(
            &attacker,
            string::utf8(b"Unauthorized"),
            string::utf8(b"sports"),
            BASE_TIME + 5,
            BASE_TIME + 8,
        );

        assert!(pulse_market::get_market_count() == 1, 40);
    }

    #[test(publisher = @pulse_market, attacker = @0x45)]
    #[expected_failure]
    fun test_non_oracle_cannot_resolve(publisher: signer, attacker: signer) {
        setup(&publisher);
        fund(signer::address_of(&attacker));

        pulse_market::create_market(
            &attacker,
            string::utf8(b"Resolve guard"),
            string::utf8(b"crypto"),
            BASE_TIME + 5,
            BASE_TIME + 8,
        );
        timestamp::update_global_time_for_test_secs(BASE_TIME + 6);
        pulse_market::close_market(&attacker, 0);
        timestamp::update_global_time_for_test_secs(BASE_TIME + 9);
        pulse_market::resolve_market(&attacker, 0, true);
    }

    #[test(publisher = @pulse_market, user_a = @0x51)]
    fun test_multiple_bets_accumulate(publisher: signer, user_a: signer) {
        setup(&publisher);
        fund(signer::address_of(&user_a));

        pulse_market::create_market(
            &publisher,
            string::utf8(b"Accumulate"),
            string::utf8(b"crypto"),
            BASE_TIME + 30,
            BASE_TIME + 60,
        );

        pulse_market::place_bet(&user_a, 0, true, 10);
        pulse_market::place_bet(&user_a, 0, true, 20);
        pulse_market::place_bet(&user_a, 0, false, 5);

        let (yes_amount, no_amount, claimed) =
            pulse_market::get_user_position(0, signer::address_of(&user_a));
        assert!(yes_amount == 30, 31);
        assert!(no_amount == 5, 32);
        assert!(!claimed, 33);
    }

    #[test(publisher = @pulse_market, user_a = @0x61, user_b = @0x62)]
    fun test_smoke_real_balance_transfers(
        publisher: signer,
        user_a: signer,
        user_b: signer,
    ) {
        setup(&publisher);
        let a_addr = signer::address_of(&user_a);
        let b_addr = signer::address_of(&user_b);
        fund(a_addr);
        fund(b_addr);

        let umin = coin::metadata(@minitia_std, string::utf8(b"umin"));
        let vault_addr = pulse_market::get_vault_owner();
        let a_before = coin::balance(a_addr, umin);
        let vault_before = coin::balance(vault_addr, umin);

        let close_time = BASE_TIME + 6;
        let resolve_time = BASE_TIME + 8;
        pulse_market::create_market(
            &publisher,
            string::utf8(b"smoke transfer"),
            string::utf8(b"crypto"),
            close_time,
            resolve_time,
        );
        pulse_market::place_bet(&user_a, 0, true, 1_000);
        pulse_market::place_bet(&user_b, 0, false, 500);

        let a_after_bet = coin::balance(a_addr, umin);
        let vault_after_bet = coin::balance(vault_addr, umin);
        assert!(a_after_bet == a_before - 1_000, 100);
        assert!(vault_after_bet == vault_before + 1_500, 101);

        timestamp::update_global_time_for_test_secs(close_time + 1);
        pulse_market::close_market(&user_a, 0);
        timestamp::update_global_time_for_test_secs(resolve_time + 1);
        pulse_market::resolve_market(&publisher, 0, true);
        pulse_market::claim_winnings(&user_a, 0);

        let a_after_claim = coin::balance(a_addr, umin);
        let vault_after_claim = coin::balance(vault_addr, umin);
        assert!(a_after_claim == a_before + 470, 102);
        assert!(vault_after_claim == vault_before + 0, 103);
    }

    #[test(publisher = @pulse_market, user_a = @0x71, user_b = @0x72)]
    fun test_fee_recipient_balance_increases_exactly(
        publisher: signer,
        user_a: signer,
        user_b: signer,
    ) {
        setup(&publisher);
        let p_addr = signer::address_of(&publisher);
        let a_addr = signer::address_of(&user_a);
        let b_addr = signer::address_of(&user_b);
        fund(a_addr);
        fund(b_addr);

        let umin = coin::metadata(@minitia_std, string::utf8(b"umin"));
        let fee_before = coin::balance(p_addr, umin);

        let close_time = BASE_TIME + 9;
        let resolve_time = BASE_TIME + 12;
        pulse_market::create_market(
            &publisher,
            string::utf8(b"fee transfer"),
            string::utf8(b"sports"),
            close_time,
            resolve_time,
        );
        pulse_market::place_bet(&user_a, 0, true, 1_000);
        pulse_market::place_bet(&user_b, 0, false, 500);

        timestamp::update_global_time_for_test_secs(close_time + 1);
        pulse_market::close_market(&user_a, 0);
        timestamp::update_global_time_for_test_secs(resolve_time + 1);
        pulse_market::resolve_market(&publisher, 0, true);

        pulse_market::claim_winnings(&user_a, 0);

        let fee_after = coin::balance(p_addr, umin);
        assert!(fee_after == fee_before + 30, 200);
        assert!(pulse_market::get_fee_collected_total() == 30, 201);
    }
}
