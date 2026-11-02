# 오디오 라이선스 기록

- 외부에서 가져온 소리는 모두 **CC0 1.0** ([증서](https://creativecommons.org/publicdomain/zero/1.0/))입니다. 저작권을 포기한 퍼블릭 도메인 헌정이라 상업 사용, 크레딧 표기, 2차 가공에 조건이 없습니다.
- 소리마다 **그 소리의 OpenGameArt 페이지**에서 라이선스란에 CC0 한 가지만 적혀 있는 것을 확인했습니다 (확인일 2026-11-02, `tools/verify_licenses.py`). 파일 목록과 크기도 페이지와 같습니다.
- 작가가 적은 "크레딧을 주시면 기쁘겠다"는 말은 부탁일 뿐 조건이 아닙니다. 아래 "작가의 말"에 그대로 옮겨 두었습니다.
- 쓰지 않는 것: CC-BY, CC-BY-SA, NC, ND, 개인 사용 한정, 출처나 조건이 불분명한 것.
- `생성`은 `tools/synth.mjs`로 직접 합성한 소리입니다. 외부 샘플을 쓰지 않았고 우리 코드의 결과물입니다.
- 후보는 `candidates/`에 있고 git에는 넣지 않습니다(`bunker/.gitignore`). 파일은 `tools/process.py`가 `tools/candidates.json`과 내려받은 원본에서 다시 만들 수 있습니다.
- 가공 내용은 파일마다 적었습니다. 공통: 44.1kHz OGG Vorbis로 변환, 음악은 약 -16 LUFS, 효과음은 최대 음량 -1 dBTP(모노).

후보 파일 107개 / 외부 소스 52곳 / 생성 23개

## 한눈에 보기

| 분류 | 파일 | 출처 |
|---|---|---|
| 지상 전투 | `candidates/music-ground/bgm_ground_spacebattle.ogg` | MintoDog · Space Battle |
| 지상 전투 | `candidates/music-ground/bgm_ground_finalstand.ogg` | iamoneabe · Final Stand |
| 지상 전투 | `candidates/music-ground/bgm_ground_level2.ogg` | SubspaceAudio · 5 Chiptunes (Action) |
| 지하 쉘터 | `candidates/music-shelter/bgm_shelter_afternoon.ogg` | MintoDog · Post-Apocalyptic Morning, Afternoon and Night |
| 지하 쉘터 | `candidates/music-shelter/bgm_shelter_morning.ogg` | MintoDog · Post-Apocalyptic Morning, Afternoon and Night |
| 지하 쉘터 | `candidates/music-shelter/bgm_shelter_hushhamlet.ogg` | Zane Little Music · Hush Hamlet |
| 보스전 | `candidates/music-boss/bgm_boss_epic.ogg` | SubspaceAudio · Boss Battle Music |
| 보스전 | `candidates/music-boss/bgm_boss_danger.ogg` | HydroGene · 8-bit Danger!! Strong Boss |
| 보스전 | `candidates/music-boss/bgm_boss_metal9.ogg` | nene · Boss Battle #9 [Metal] |
| 상점·뽑기 | `candidates/music-shop/bgm_shop_shoppingtime.ogg` | SkyleTheFrench · Shopping Time! |
| 상점·뽑기 | `candidates/music-shop/bgm_shop_urbanshop.ogg` | MintoDog · Urban Shop |
| 상점·뽑기 | `candidates/music-shop/bgm_shop_bossa.ogg` | Joth · Bossa Nova |
| 승리 | `candidates/sting-win/jgl_win_nes.ogg` | congusbongus · Glorious victory fanfare NES |
| 승리 | `candidates/sting-win/jgl_win_stageclear.ogg` | MintoDog · 8bit Action Jingle & Mini Loop |
| 승리 | `candidates/sting-win/jgl_win_winner.ogg` | congusbongus · And the winner is |
| 실패 | `candidates/sting-fail/jgl_fail_betterluck.ogg` | congusbongus · Better luck next time |
| 실패 | `candidates/sting-fail/jgl_fail_gameover.ogg` | MintoDog · 8bit Action Jingle & Mini Loop |
| 실패 | `candidates/sting-fail/jgl_fail_sadpiano.ogg` | Emma_MA · Sad game over |
| 등급 공개 | `candidates/sting-reveal/jgl_reveal_newthing.ogg` | congusbongus · New thing get! |
| 등급 공개 | `candidates/sting-reveal/jgl_reveal_twist.ogg` | congusbongus · A surprising twist (NES sting) |
| 등급 공개 | `candidates/sting-reveal/jgl_reveal_hyper.ogg` | Zane Little Music · Hyper-Ultra-Fanfare |
| 총소리 | `candidates/sfx-gun/sfx_gun_pistol_a.ogg` | Ben Jaszczak, et al. · The Free Firearm Sound Library |
| 총소리 | `candidates/sfx-gun/sfx_gun_pistol_b.ogg` | Ben Jaszczak, et al. · The Free Firearm Sound Library |
| 총소리 | `candidates/sfx-gun/sfx_gun_smg_a.ogg` | Ben Jaszczak, et al. · The Free Firearm Sound Library |
| 총소리 | `candidates/sfx-gun/sfx_gun_smg_b.ogg` | Ben Jaszczak, et al. · The Free Firearm Sound Library |
| 총소리 | `candidates/sfx-gun/sfx_gun_rifle_a.ogg` | Ben Jaszczak, et al. · The Free Firearm Sound Library |
| 총소리 | `candidates/sfx-gun/sfx_gun_rifle_b.ogg` | Ben Jaszczak, et al. · The Free Firearm Sound Library |
| 총소리 | `candidates/sfx-gun/sfx_gun_shotgun_a.ogg` | Ben Jaszczak, et al. · The Free Firearm Sound Library |
| 총소리 | `candidates/sfx-gun/sfx_gun_shotgun_b.ogg` | Ben Jaszczak, et al. · The Free Firearm Sound Library |
| 총소리 | `candidates/sfx-gun/sfx_gun_sniper_a.ogg` | Ben Jaszczak, et al. · The Free Firearm Sound Library |
| 총소리 | `candidates/sfx-gun/sfx_gun_sniper_b.ogg` | Ben Jaszczak, et al. · The Free Firearm Sound Library |
| 총소리 | `candidates/sfx-gun/sfx_gun_mg_a.ogg` | Ben Jaszczak, et al. · The Free Firearm Sound Library |
| 총소리 | `candidates/sfx-gun/sfx_gun_mg_b.ogg` | Ben Jaszczak, et al. · The Free Firearm Sound Library |
| 총소리 | `candidates/sfx-gun/sfx_gun_flame_a.ogg` | LEGIT Audio · Fire Staff Sound Effects |
| 총소리 | `candidates/sfx-gun/sfx_gun_flame_b.ogg` | 생성 |
| 총소리 | `candidates/sfx-gun/sfx_gun_electric_a.ogg` | BMacZero · Electricity Sound Effects |
| 총소리 | `candidates/sfx-gun/sfx_gun_electric_b.ogg` | faxcorp · Electricity Game Sound Pack |
| 총소리 | `candidates/sfx-gun/sfx_gun_electric_c.ogg` | 생성 |
| 장전·탄피 | `candidates/sfx-reload/sfx_reload_pistol_a.ogg` | zer0_sol · Handgun Reload Sound Effect |
| 장전·탄피 | `candidates/sfx-reload/sfx_reload_pistol_b.ogg` | SpringySpringo · Gun reload sounds |
| 장전·탄피 | `candidates/sfx-reload/sfx_reload_rifle_a.ogg` | SpringySpringo · Gun reload sounds |
| 장전·탄피 | `candidates/sfx-reload/sfx_reload_shotgun_a.ogg` | zer0_sol · Shotgun Reload Sound effects |
| 장전·탄피 | `candidates/sfx-reload/sfx_reload_shotgun_b.ogg` | SpringySpringo · Gun reload sounds |
| 장전·탄피 | `candidates/sfx-reload/sfx_casing_a.ogg` | 생성 |
| 장전·탄피 | `candidates/sfx-reload/sfx_casing_b.ogg` | BMacZero · Metal Impact Sounds |
| 명중 | `candidates/sfx-impact/sfx_hit_flesh_a.ogg` | Independent.nu · 8 wet squish, slurp impacts |
| 명중 | `candidates/sfx-impact/sfx_hit_flesh_b.ogg` | Zane Little Music · Fleshy Bone Break/Snap SFX |
| 명중 | `candidates/sfx-impact/sfx_hit_armor_a.ogg` | rubberduck · 100 CC0 metal and wood SFX |
| 명중 | `candidates/sfx-impact/sfx_hit_armor_b.ogg` | BMacZero · Metal Impact Sounds |
| 명중 | `candidates/sfx-impact/sfx_hit_wall_a.ogg` | rubberduck · 75 CC0 breaking / falling / hit sfx |
| 명중 | `candidates/sfx-impact/sfx_hit_wall_b.ogg` | rubberduck · 75 CC0 breaking / falling / hit sfx |
| 좀비 | `candidates/sfx-zombie/sfx_zombie_groan_1.ogg` | EmoPreben · Zombie Moans 01 - By EmoPreben |
| 좀비 | `candidates/sfx-zombie/sfx_zombie_groan_2.ogg` | artisticdude · Zombies Sound Pack |
| 좀비 | `candidates/sfx-zombie/sfx_zombie_groan_3.ogg` | Darsycho · Zombie moans |
| 좀비 | `candidates/sfx-zombie/sfx_zombie_groan_4.ogg` | AntumDeluge · Undead Moans |
| 좀비 | `candidates/sfx-zombie/sfx_zombie_groan_5.ogg` | ianzazz · Zombie noises and moans |
| 좀비 | `candidates/sfx-zombie/sfx_zombie_groan_6.ogg` | Darsycho · Zombie moans |
| 좀비 | `candidates/sfx-zombie/sfx_zombie_death_1.ogg` | ArcadeParty · Zombie / Skeleton / Monster Voice Effects |
| 좀비 | `candidates/sfx-zombie/sfx_zombie_death_2.ogg` | ArcadeParty · Zombie / Skeleton / Monster Voice Effects |
| 좀비 | `candidates/sfx-zombie/sfx_zombie_death_3.ogg` | ArcadeParty · Zombie / Skeleton / Monster Voice Effects |
| 좀비 | `candidates/sfx-zombie/sfx_zombie_death_4.ogg` | ArcadeParty · Zombie / Skeleton / Monster Voice Effects |
| 보스 | `candidates/sfx-boss/sfx_boss_roar_a.ogg` | Darsycho · Big scary troll sounds |
| 보스 | `candidates/sfx-boss/sfx_boss_roar_b.ogg` | Ogrebane · Monster Sound Pack, Volume 1 |
| 보스 | `candidates/sfx-boss/sfx_boss_roar_c.ogg` | trazzz123 · CC0 Deep Monster Roar |
| 보스 | `candidates/sfx-boss/sfx_boss_stomp_a.ogg` | bart · 68 Workshop Sounds |
| 보스 | `candidates/sfx-boss/sfx_boss_stomp_b.ogg` | rubberduck · 80 CC0 creture SFX #2 |
| 보스 | `candidates/sfx-boss/sfx_boss_stomp_c.ogg` | 생성 |
| 기지 | `candidates/sfx-base/sfx_fence_hit_a.ogg` | rubberduck · 100 CC0 metal and wood SFX |
| 기지 | `candidates/sfx-base/sfx_fence_hit_b.ogg` | rubberduck · 100 CC0 metal and wood SFX |
| 기지 | `candidates/sfx-base/sfx_fence_break_a.ogg` | rubberduck · 75 CC0 breaking / falling / hit sfx |
| 기지 | `candidates/sfx-base/sfx_fence_break_b.ogg` | Independent.nu · 35 wooden cracks/hits/destructions |
| 기지 | `candidates/sfx-base/sfx_repair_a.ogg` | bart · 68 Workshop Sounds |
| 기지 | `candidates/sfx-base/sfx_repair_b.ogg` | bart · 68 Workshop Sounds |
| 기지 | `candidates/sfx-base/sfx_repair_c.ogg` | rubberduck · 100 CC0 metal and wood SFX |
| 기지 | `candidates/sfx-base/sfx_build_a.ogg` | bart · 68 Workshop Sounds |
| 기지 | `candidates/sfx-base/sfx_build_b.ogg` | bart · 68 Workshop Sounds |
| 기지 | `candidates/sfx-base/sfx_breakthrough_a.ogg` | 생성 |
| 기지 | `candidates/sfx-base/sfx_breakthrough_b.ogg` | wobbleboxx · Level up, power up, Coin get (13 Sounds) |
| UI | `candidates/sfx-ui/sfx_ui_button_a.ogg` | 생성 |
| UI | `candidates/sfx-ui/sfx_ui_button_b.ogg` | Robin Lamb · UI Sound Effects (Button Clicks, User Feedback, Notifications) |
| UI | `candidates/sfx-ui/sfx_ui_tab_a.ogg` | 생성 |
| UI | `candidates/sfx-ui/sfx_ui_tab_b.ogg` | Robin Lamb · UI Sound Effects (Button Clicks, User Feedback, Notifications) |
| UI | `candidates/sfx-ui/sfx_ui_purchase_a.ogg` | 생성 |
| UI | `candidates/sfx-ui/sfx_ui_purchase_b.ogg` | rubberduck · 80 CC0 RPG SFX |
| UI | `candidates/sfx-ui/sfx_ui_levelup_a.ogg` | 생성 |
| UI | `candidates/sfx-ui/sfx_ui_levelup_b.ogg` | MouseBYTE · Chimey UI Sounds |
| UI | `candidates/sfx-ui/sfx_ui_clear_a.ogg` | 생성 |
| UI | `candidates/sfx-ui/sfx_ui_clear_b.ogg` | Joth · 7 Assorted Sound Effects (Menu, Level Up) |
| UI | `candidates/sfx-ui/sfx_ui_warning_a.ogg` | 생성 |
| UI | `candidates/sfx-ui/sfx_ui_warning_b.ogg` | yd · Short alarm |
| UI | `candidates/sfx-ui/sfx_ui_notify_a.ogg` | 생성 |
| UI | `candidates/sfx-ui/sfx_ui_notify_b.ogg` | Robin Lamb · UI Sound Effects (Button Clicks, User Feedback, Notifications) |
| 뽑기 | `candidates/sfx-gacha/sfx_gacha_roll_a.ogg` | 생성 |
| 뽑기 | `candidates/sfx-gacha/sfx_gacha_roll_b.ogg` | bart · 68 Workshop Sounds |
| 뽑기 | `candidates/sfx-gacha/sfx_reveal_1.ogg` | 생성 |
| 뽑기 | `candidates/sfx-gacha/sfx_reveal_2.ogg` | 생성 |
| 뽑기 | `candidates/sfx-gacha/sfx_reveal_3.ogg` | 생성 |
| 뽑기 | `candidates/sfx-gacha/sfx_reveal_4.ogg` | 생성 |
| 뽑기 | `candidates/sfx-gacha/sfx_reveal_5.ogg` | 생성 |
| 뽑기 | `candidates/sfx-gacha/sfx_reveal_6.ogg` | 생성 |
| 뽑기 | `candidates/sfx-gacha/sfx_reveal_7.ogg` | 생성 |
| 뽑기 | `candidates/sfx-gacha/sfx_reveal_8.ogg` | 생성 |
| 유물·습격 | `candidates/sfx-misc/sfx_relic_a.ogg` | 생성 |
| 유물·습격 | `candidates/sfx-misc/sfx_relic_b.ogg` | Bobjt · Gem collect SFX |
| 유물·습격 | `candidates/sfx-misc/sfx_raid_a.ogg` | 생성 |
| 유물·습격 | `candidates/sfx-misc/sfx_raid_b.ogg` | StumpyStrust · Their Coming (generic horn sound) |
| 유물·습격 | `candidates/sfx-misc/sfx_raid_c.ogg` | aquinn · Sirens and Alarm Noise |

## 외부 소스 (CC0)

### 5 Chiptunes (Action)

- 작가: [SubspaceAudio](https://opengameart.org/users/subspaceaudio)
- 출처 페이지: https://opengameart.org/content/5-chiptunes-action
- 원본 파일: https://opengameart.org/sites/default/files/5%20Action%20Chiptunes%20By%20Juhani%20Junkala.zip  
  (`5 Action Chiptunes By Juhani Junkala.zip`, 49,639,688 bytes, SHA-256 `ea189990c0fb9a700187ccc740eda72400341a082305a163867467d96346460d`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/music-ground/bgm_ground_level2.ogg` (1:12.8) | Juhani Junkala [Retro Game Music Pack] Level 2.wav | 음량 -16 LUFS로 맞춤; OGG Vorbis로 변환 |

### Boss Battle Music

- 작가: [SubspaceAudio](https://opengameart.org/users/subspaceaudio)
- 출처 페이지: https://opengameart.org/content/boss-battle-music
- 원본 파일: https://opengameart.org/sites/default/files/Juhani%20Junkala%20-%20Epic%20Boss%20Battle%20%5BSeamlessly%20Looping%5D.wav  
  (`Juhani Junkala - Epic Boss Battle [Seamlessly Looping].wav`, 21,773,152 bytes, SHA-256 `35f75b4381dfbb053992876f7dfc567d9fd959d61b73954d5b1cd519753e7df1`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/music-boss/bgm_boss_epic.ogg` (2:03.4) | Juhani Junkala - Epic Boss Battle [Seamlessly Looping].wav | 음량 -16 LUFS로 맞춤; OGG Vorbis로 변환 |

### Space Battle

- 작가: [MintoDog](https://opengameart.org/users/mintodog)
- 출처 페이지: https://opengameart.org/content/space-battle
- 원본 파일: https://opengameart.org/sites/default/files/space_battle_bpm130_0.ogg  
  (`space_battle_bpm130.ogg`, 2,898,663 bytes, SHA-256 `22de767fe7b621eec9cd081d12f4fce4d5effda528bfee90e404dcc2916d485b`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/music-ground/bgm_ground_spacebattle.ogg` (1:28.6) | space_battle_bpm130.ogg | 음량 -16 LUFS로 맞춤; OGG Vorbis로 변환 |

### Post-Apocalyptic Morning, Afternoon and Night

- 작가: [MintoDog](https://opengameart.org/users/mintodog)
- 출처 페이지: https://opengameart.org/content/post-apocalyptic-morning-afternoon-and-night
- 원본 파일: https://opengameart.org/sites/default/files/post-apocalyptic_morning_bpm80_0.ogg  
  (`post-apocalyptic_morning_bpm80.ogg`, 3,586,072 bytes, SHA-256 `3559833f54a607cf7a36d4fcef92f440caefde036304f78546f41353774ebe4a`)
- 원본 파일: https://opengameart.org/sites/default/files/post-apocalyptic_afternoon_bpm85_0.ogg  
  (`post-apocalyptic_afternoon_bpm85.ogg`, 4,123,477 bytes, SHA-256 `658f47d0b8e329e2e1051c5d9f6041da65c92da04df831da758379b0f342d221`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/music-shelter/bgm_shelter_afternoon.ogg` (2:15.5) | post-apocalyptic_afternoon_bpm85.ogg | 음량 -16 LUFS로 맞춤; OGG Vorbis로 변환 |
| `candidates/music-shelter/bgm_shelter_morning.ogg` (2:00.0) | post-apocalyptic_morning_bpm80.ogg | 음량 -16 LUFS로 맞춤; OGG Vorbis로 변환 |

### Urban Shop

- 작가: [MintoDog](https://opengameart.org/users/mintodog)
- 출처 페이지: https://opengameart.org/content/urban-shop
- 원본 파일: https://opengameart.org/sites/default/files/urban_shop_bpm92_0.ogg  
  (`urban_shop_bpm92.ogg`, 2,735,750 bytes, SHA-256 `7f7e70a28b65144d70969e008add149ccfb3bdd6e09170bf94e09ed2a56ac66b`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/music-shop/bgm_shop_urbanshop.ogg` (1:23.5) | urban_shop_bpm92.ogg | 음량 -16 LUFS로 맞춤; OGG Vorbis로 변환 |

### 8bit Action Jingle & Mini Loop

- 작가: [MintoDog](https://opengameart.org/users/mintodog)
- 출처 페이지: https://opengameart.org/content/8bit-action-jingle-mini-loop
- 원본 파일: https://opengameart.org/sites/default/files/ogg_8bit_action_jingle_mini_loop.zip  
  (`ogg_8bit_action_jingle_mini_loop.zip`, 1,214,309 bytes, SHA-256 `221cfb1835444b5dbdd9b0e64c8ea4e1b7ada20f69631a8973cd83717da52aae`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/sting-win/jgl_win_stageclear.ogg` (6.26초) | ogg_8bit Action Jingle & Mini Loop/Stage Clear Long (Jingle).ogg | 앞뒤 무음 0.28초 제거; 직류 성분 제거; 음량 -16 LUFS로 맞춤; OGG Vorbis로 변환 |
| `candidates/sting-fail/jgl_fail_gameover.ogg` (4.37초) | ogg_8bit Action Jingle & Mini Loop/GameOver (Jingle).ogg | 앞뒤 무음 0.44초 제거; 직류 성분 제거; 음량 -16 LUFS로 맞춤; OGG Vorbis로 변환 |

### Glorious victory fanfare NES

- 작가: [congusbongus](https://opengameart.org/users/congusbongus)
- 출처 페이지: https://opengameart.org/content/glorious-victory-fanfare-nes
- 원본 파일: https://opengameart.org/sites/default/files/victory2_0.ogg  
  (`victory2.ogg`, 263,719 bytes, SHA-256 `7be73d492c038bce957bbbfbe479c7210fd58b50ae52f3ddf58b5514b0fd894e`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/sting-win/jgl_win_nes.ogg` (10.67초) | victory2.ogg | 앞뒤 무음 0.31초 제거; 직류 성분 제거; 0.3초 페이드아웃; 음량 -16 LUFS로 맞춤; OGG Vorbis로 변환 |

### And the winner is

- 작가: [congusbongus](https://opengameart.org/users/congusbongus)
- 출처 페이지: https://opengameart.org/content/and-the-winner-is
- 원본 파일: https://opengameart.org/sites/default/files/winneris_0.ogg  
  (`winneris.ogg`, 95,926 bytes, SHA-256 `97f341d02231606742372f565d0c63354f96336f6a62c27991942356f8f2291f`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/sting-win/jgl_win_winner.ogg` (3.86초) | winneris.ogg | 직류 성분 제거; 0.2초 페이드아웃; 음량 -16 LUFS로 맞춤; OGG Vorbis로 변환 |

### Better luck next time

- 작가: [congusbongus](https://opengameart.org/users/congusbongus)
- 출처 페이지: https://opengameart.org/content/better-luck-next-time
- 원본 파일: https://opengameart.org/sites/default/files/betterluck_0.ogg  
  (`betterluck.ogg`, 83,738 bytes, SHA-256 `bee3d54ffad75fc0e01e1e9d34f765461be98dd34c4914e818405c44badadada`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/sting-fail/jgl_fail_betterluck.ogg` (2.91초) | betterluck.ogg | 앞뒤 무음 0.04초 제거; 직류 성분 제거; 음량 -16 LUFS로 맞춤; OGG Vorbis로 변환 |

### New thing get!

- 작가: [congusbongus](https://opengameart.org/users/congusbongus)
- 출처 페이지: https://opengameart.org/content/new-thing-get
- 원본 파일: https://opengameart.org/sites/default/files/newthingget_0.ogg  
  (`newthingget.ogg`, 173,459 bytes, SHA-256 `dbebe58b4fcd7c3a3ecfd887a40f0160ae82ed2d0375c187b9e8c49e596fd724`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/sting-reveal/jgl_reveal_newthing.ogg` (5.34초) | newthingget.ogg | 직류 성분 제거; 음량 -16 LUFS로 맞춤; OGG Vorbis로 변환 |

### A surprising twist (NES sting)

- 작가: [congusbongus](https://opengameart.org/users/congusbongus)
- 출처 페이지: https://opengameart.org/content/a-surprising-twist-nes-sting
- 원본 파일: https://opengameart.org/sites/default/files/surprise_0.ogg  
  (`surprise.ogg`, 85,071 bytes, SHA-256 `cc3c6836f735ebda327f14906623d50fbc6b15092625acd215744ce8b34822d6`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/sting-reveal/jgl_reveal_twist.ogg` (3.35초) | surprise.ogg | 앞뒤 무음 0.38초 제거; 직류 성분 제거; 음량 -16 LUFS로 맞춤; OGG Vorbis로 변환 |

### 8-bit Danger!! Strong Boss

- 작가: [HydroGene](https://opengameart.org/users/hydrogene)
- 출처 페이지: https://opengameart.org/content/8-bit-danger-strong-boss
- 원본 파일: https://opengameart.org/sites/default/files/8-bit_danger_strong_boss_0.mp3  
  (`8-bit_danger_strong_boss.mp3`, 5,348,902 bytes, SHA-256 `06651ec01b08d118c1d7216a96a0214272367bf84cb96e287a943c94badb8c76`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)
- 작가의 말: "credits are NOT mandatory, but I'm curious to know what you will do with it, so don't hesitate to share :)"

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/music-boss/bgm_boss_danger.ogg` (2:13.7) | 8-bit_danger_strong_boss.mp3 | 디코더가 붙인 무음(앞 28ms, 뒤 21ms)을 잘라 반복 틈 제거; 음량 -16 LUFS로 맞춤; OGG Vorbis로 변환 |

### Boss Battle #9 [Metal]

- 작가: [nene](https://opengameart.org/users/nene)
- 출처 페이지: https://opengameart.org/content/boss-battle-9-metal
- 원본 파일: https://opengameart.org/sites/default/files/boss_battle_9_metal_loop.wav  
  (`boss_battle_9_metal_loop.wav`, 7,493,242 bytes, SHA-256 `1d82943900929e5714426e50a7456e8414353c3b61a4c7fb7fc8d4ebb2195570`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/music-boss/bgm_boss_metal9.ogg` (42.48초) | boss_battle_9_metal_loop.wav | 음량 -16 LUFS로 맞춤; OGG Vorbis로 변환 |

### Final Stand

- 작가: [iamoneabe](https://opengameart.org/users/iamoneabe)
- 출처 페이지: https://opengameart.org/content/final-stand
- 원본 파일: https://opengameart.org/sites/default/files/final_stand.wav  
  (`final_stand.wav`, 11,290,334 bytes, SHA-256 `f976fac90a6400ab3c29d9792ad1aea29485bee72b17424d27afbe5655dec932`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)
- 작가의 말: "CC0 // Public Domain OPTIONAL: https://allmylinks.com/iamoneabe"

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/music-ground/bgm_ground_finalstand.ogg` (1:04.0) | final_stand.wav | 반복 이음새의 딸깍 소리를 없애려고 맨 앞뒤 4ms를 페이드; 음량 -16 LUFS로 맞춤; OGG Vorbis로 변환 |

### Hush Hamlet

- 작가: [Zane Little Music](https://opengameart.org/users/zane-little-music)
- 출처 페이지: https://opengameart.org/content/hush-hamlet
- 원본 파일: https://opengameart.org/sites/default/files/hush_hamlet_loop_0.wav  
  (`hush_hamlet_loop.wav`, 36,864,210 bytes, SHA-256 `a0761ded88634442fec6e7f02c875ec9745692acd9089c715d73a51a38b883fa`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/music-shelter/bgm_shelter_hushhamlet.ogg` (1:36.0) | hush_hamlet_loop.wav | 음량 -16 LUFS로 맞춤 (피크 리미터); OGG Vorbis로 변환 |

### Shopping Time!

- 작가: [SkyleTheFrench](https://opengameart.org/users/skylethefrench)
- 출처 페이지: https://opengameart.org/content/shopping-time
- 원본 파일: https://opengameart.org/sites/default/files/shopping_time_loop.ogg  
  (`shopping_time_loop.ogg`, 2,158,153 bytes, SHA-256 `6e1d8674f0699e1d5927a4a2ff92d7cd997998620f7271ae589fea642a5f622b`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)
- 작가의 말: "No need to credit, but appreciate if you do so! <3"

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/music-shop/bgm_shop_shoppingtime.ogg` (1:28.7) | shopping_time_loop.ogg | 음량 -16 LUFS로 맞춤; OGG Vorbis로 변환 |

### Bossa Nova

- 작가: [Joth](https://opengameart.org/users/joth)
- 출처 페이지: https://opengameart.org/content/bossa-nova
- 원본 파일: https://opengameart.org/sites/default/files/8bit%20Bossa.mp3  
  (`8bit Bossa.mp3`, 1,196,325 bytes, SHA-256 `0ee835fd279ac5fa15f9346744cbafc2ba800c1c0671b78ca9abe2b4353402f7`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/music-shop/bgm_shop_bossa.ogg` (59.55초) | 8bit Bossa.mp3 | 디코더가 붙인 무음(앞 11ms, 뒤 52ms)을 잘라 반복 틈 제거; 음량 -16 LUFS로 맞춤 (피크 리미터); OGG Vorbis로 변환 |

### Sad game over

- 작가: [Emma_MA](https://opengameart.org/users/emmama)
- 출처 페이지: https://opengameart.org/content/sad-game-over
- 원본 파일: https://opengameart.org/sites/default/files/sad_game_over.wav  
  (`sad_game_over.wav`, 3,353,414 bytes, SHA-256 `4c36050c26197c339373cdd885ec6881f9f89899852aa574c4f58c7aebcad32a`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)
- 작가의 말: "This track has been released into the public domain as of January 2017."

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/sting-fail/jgl_fail_sadpiano.ogg` (10.00초) | sad_game_over.wav | 원본 0.00–11.00초 구간만 사용; 앞뒤 무음 1.00초 제거; 직류 성분 제거; 2.0초 페이드아웃; 음량 -16 LUFS로 맞춤; OGG Vorbis로 변환 |

### Hyper-Ultra-Fanfare

- 작가: [Zane Little Music](https://opengameart.org/users/zane-little-music)
- 출처 페이지: https://opengameart.org/content/hyper-ultra-fanfare
- 원본 파일: https://opengameart.org/sites/default/files/sboe.wav  
  (`sboe.wav`, 2,161,074 bytes, SHA-256 `50a50dd396bcb98dc38d502432864f0f03694d802560a6683a876c16eba771f4`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/sting-reveal/jgl_reveal_hyper.ogg` (5.17초) | sboe.wav | 앞뒤 무음 0.95초 제거; 직류 성분 제거; 0.3초 페이드아웃; 음량 -16 LUFS로 맞춤; OGG Vorbis로 변환 |

### The Free Firearm Sound Library

- 작가: [Ben Jaszczak, et al.](https://opengameart.org/users/bart)
- 출처 페이지: https://opengameart.org/content/the-free-firearm-sound-library
- 원본 파일: https://opengameart.org/sites/default/files/Prepared%20SFX%20Library.7z  
  (`Prepared SFX Library.7z`, 193,954,738 bytes, SHA-256 `cc1ab5a99a0a365105c7c5dd783f4b0b1fe90938114d3ceec53856bfe005f7d6`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/sfx-gun/sfx_gun_pistol_a.ogg` (0.90초) | Prepared SFX Library/1911/A_42P.wav | 파일 안의 소리 2개 중 1번째만 사용; 직류 성분 제거; 0.2초 페이드아웃; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-gun/sfx_gun_pistol_b.ogg` (0.69초) | Prepared SFX Library/Walther PPQ/X_39P.wav | 파일 안의 소리 3개 중 1번째만 사용; 앞뒤 무음 0.02초 제거; 직류 성분 제거; 0.2초 페이드아웃; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-gun/sfx_gun_smg_a.ogg` (0.83초) | Prepared SFX Library/PPSh/P_30P.wav | 파일 안의 소리 5개 중 1번째만 사용; 직류 성분 제거; 0.2초 페이드아웃; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-gun/sfx_gun_smg_b.ogg` (0.82초) | Prepared SFX Library/Carl Gustav M45/G_31P.wav | 파일 안의 소리 3개 중 1번째만 사용; 직류 성분 제거; 0.2초 페이드아웃; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-gun/sfx_gun_rifle_a.ogg` (0.79초) | Prepared SFX Library/AR-15/D_32P.wav | 파일 안의 소리 2개 중 1번째만 사용; 직류 성분 제거; 0.2초 페이드아웃; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-gun/sfx_gun_rifle_b.ogg` (0.84초) | Prepared SFX Library/AK-47/C_28P.wav | 파일 안의 소리 4개 중 1번째만 사용; 직류 성분 제거; 0.2초 페이드아웃; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-gun/sfx_gun_shotgun_a.ogg` (0.86초) | Prepared SFX Library/Nova/O_21P.wav | 파일 안의 소리 2개 중 1번째만 사용; 직류 성분 제거; 0.2초 페이드아웃; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-gun/sfx_gun_shotgun_b.ogg` (0.90초) | Prepared SFX Library/Model 12/K_22P.wav | 파일 안의 소리 2개 중 1번째만 사용; 직류 성분 제거; 0.2초 페이드아웃; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-gun/sfx_gun_sniper_a.ogg` (1.17초) | Prepared SFX Library/Tikka/W_29P.wav | 파일 안의 소리 2개 중 1번째만 사용; 직류 성분 제거; 0.3초 페이드아웃; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-gun/sfx_gun_sniper_b.ogg` (0.56초) | Prepared SFX Library/Mosin Nagant/M_21P.wav | 파일 안의 소리 5개 중 1번째만 사용; 직류 성분 제거; 0.2초 페이드아웃; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-gun/sfx_gun_mg_a.ogg` (1.58초) | Prepared SFX Library/AK-47/C_27P.wav | 파일 안의 소리 2개 중 1번째만 사용; 직류 성분 제거; 0.25초 페이드아웃; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-gun/sfx_gun_mg_b.ogg` (1.85초) | Prepared SFX Library/PPSh/P_34P.wav | 파일 안의 소리 1개 중 1번째만 사용; 직류 성분 제거; 0.25초 페이드아웃; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |

### Fire Staff Sound Effects

- 작가: [LEGIT Audio](https://opengameart.org/users/legit-audio)
- 출처 페이지: https://opengameart.org/content/fire-staff-sound-effects
- 원본 파일: https://opengameart.org/sites/default/files/legit_audio_fire_staff_-_free_0.zip  
  (`legit_audio_fire_staff_-_free.zip`, 29,242,305 bytes, SHA-256 `8c0668fdde03de52b9b201e672244992ae739438937d4bef6908d1618a86b020`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/sfx-gun/sfx_gun_flame_a.ogg` (1.80초) | LEGIT Audio_FIRE STAFF - FREE/Wavs/LEGIT_FIR_Fire_Staff 17-Audio.wav | 원본 0.00–1.80초 구간만 사용; 직류 성분 제거; 0.3초 페이드아웃; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |

### Electricity Game Sound Pack

- 작가: [faxcorp](https://opengameart.org/users/faxcorp)
- 출처 페이지: https://opengameart.org/content/electricity-game-sound-pack
- 원본 파일: https://opengameart.org/sites/default/files/hit.wav  
  (`hit.wav`, 389,140 bytes, SHA-256 `03d05a1249c45d795382f840c35563c0f151423afd47c04a4af7a81bad2f32fc`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/sfx-gun/sfx_gun_electric_b.ogg` (1.20초) | hit.wav | 원본 0.00–1.20초 구간만 사용; 직류 성분 제거; 0.3초 페이드아웃; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |

### Electricity Sound Effects

- 작가: [BMacZero](https://opengameart.org/users/bmaczero)
- 출처 페이지: https://opengameart.org/content/electricity-sound-effects-0
- 원본 파일: https://opengameart.org/sites/default/files/spark.wav  
  (`spark.wav`, 29,740 bytes, SHA-256 `9a3d987bdf7f405570aa015f6da42596ce84c5073c18c0561be7cd3ae401bc97`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)
- 작가의 말: "Optionally credit Brian MacIntosh."

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/sfx-gun/sfx_gun_electric_a.ogg` (0.20초) | spark.wav | 앞뒤 무음 0.14초 제거; 직류 성분 제거; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |

### Metal Impact Sounds

- 작가: [BMacZero](https://opengameart.org/users/bmaczero)
- 출처 페이지: https://opengameart.org/content/metal-impact-sounds
- 원본 파일: https://opengameart.org/sites/default/files/bing1.wav  
  (`bing1.wav`, 63,532 bytes, SHA-256 `d14941ce27e6b409e0cd941eaad7201d613070a4c3eb9c3627fec4cf3ae686e4`)
- 원본 파일: https://opengameart.org/sites/default/files/clink1_0.wav  
  (`clink1.wav`, 27,692 bytes, SHA-256 `0d439cd2b1f36f501b94c39661e39f91d160affe25c79f77dff7a2cd0ed7eadd`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)
- 작가의 말: "Optionally credit Brian MacIntosh."

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/sfx-reload/sfx_casing_b.ogg` (0.31초) | clink1.wav | 직류 성분 제거; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-impact/sfx_hit_armor_b.ogg` (0.71초) | bing1.wav | 직류 성분 제거; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |

### Handgun Reload Sound Effect

- 작가: [zer0_sol](https://opengameart.org/users/zer0sol)
- 출처 페이지: https://opengameart.org/content/handgun-reload-sound-effect
- 원본 파일: https://opengameart.org/sites/default/files/reload.wav  
  (`reload.wav`, 280,620 bytes, SHA-256 `091399145b174ac3b2e0df245b4712a13ce85df072e37256b0fc32658718be53`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)
- 작가의 말: "No attribution required. If you want to that's great, but it's not important to me."

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/sfx-reload/sfx_reload_pistol_a.ogg` (1.35초) | reload.wav | 앞뒤 무음 0.24초 제거; 직류 성분 제거; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |

### Shotgun Reload Sound effects

- 작가: [zer0_sol](https://opengameart.org/users/zer0sol)
- 출처 페이지: https://opengameart.org/content/shotgun-reload-sound-effects
- 원본 파일: https://opengameart.org/sites/default/files/shotgunsounds.zip  
  (`shotgunsounds.zip`, 324,193 bytes, SHA-256 `31128a93eee729cadcd1cdeabca6b6b1f655578101109b59c0fb5dd4b96e6079`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/sfx-reload/sfx_reload_shotgun_a.ogg` (0.51초) | ShotgunSounds/Rack.mp3 | 앞뒤 무음 0.61초 제거; 직류 성분 제거; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |

### Gun reload sounds

- 작가: [SpringySpringo](https://opengameart.org/users/springyspringo)
- 출처 페이지: https://opengameart.org/content/gun-reload-sounds
- 원본 파일: https://opengameart.org/sites/default/files/gunreload1.wav  
  (`gunreload1.wav`, 278,572 bytes, SHA-256 `685cac6a184e3cc3ec09a25b6ddb1d6feffd86d469778f339aa423d384035c50`)
- 원본 파일: https://opengameart.org/sites/default/files/assaultriflereload1_0.wav  
  (`assaultriflereload1.wav`, 274,476 bytes, SHA-256 `efb2d724d634eabe6ba8d3065686abca848bb7497d4d43a5e4aed5e5ea23016f`)
- 원본 파일: https://opengameart.org/sites/default/files/shotguncock_0.wav  
  (`shotguncock.wav`, 83,628 bytes, SHA-256 `33e007321ba83301c861aef573f2c40b70bc62f8f24c0164877e6dd123e24371`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)
- 작가의 말: "Credit isn't required, but appreciated. If you use this in any project shoot me a link in the comments!"

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/sfx-reload/sfx_reload_pistol_b.ogg` (1.51초) | gunreload1.wav | 앞뒤 무음 0.07초 제거; 직류 성분 제거; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-reload/sfx_reload_rifle_a.ogg` (1.41초) | assaultriflereload1.wav | 앞뒤 무음 0.15초 제거; 직류 성분 제거; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-reload/sfx_reload_shotgun_b.ogg` (0.43초) | shotguncock.wav | 앞뒤 무음 0.04초 제거; 직류 성분 제거; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |

### Fleshy Bone Break/Snap SFX

- 작가: [Zane Little Music](https://opengameart.org/users/zane-little-music)
- 출처 페이지: https://opengameart.org/content/fleshy-bone-breaksnap-sfx
- 원본 파일: https://opengameart.org/sites/default/files/wet_breaks.zip  
  (`wet_breaks.zip`, 2,712,724 bytes, SHA-256 `56c1690b3f6dc231c5e5ea6f651182ecb8f0a43a087f3c864d6f8dc9ec5280cd`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/sfx-impact/sfx_hit_flesh_b.ogg` (0.48초) | Wet Break 9.wav | 앞뒤 무음 0.07초 제거; 직류 성분 제거; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |

### 8 wet squish, slurp impacts

- 작가: [Independent.nu](https://opengameart.org/users/qubodup)
- 출처 페이지: https://opengameart.org/content/8-wet-squish-slurp-impacts
- 원본 파일: https://opengameart.org/sites/default/files/independent_nu_ljudbank-wet_squish_slurp_impacts.7z  
  (`independent_nu_ljudbank-wet_squish_slurp_impacts.7z`, 586,806 bytes, SHA-256 `81fba6009d1b3e48c258b122eef735ed27e86a2dcace9b6a2c93d05b80c83515`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/sfx-impact/sfx_hit_flesh_a.ogg` (0.48초) | impsplat/impactsplat07.mp3.flac | 앞뒤 무음 0.04초 제거; 직류 성분 제거; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |

### 35 wooden cracks/hits/destructions

- 작가: [Independent.nu](https://opengameart.org/users/qubodup)
- 출처 페이지: https://opengameart.org/content/35-wooden-crackshitsdestructions
- 원본 파일: https://opengameart.org/sites/default/files/independent_nu_ljudbank-wood_crack_hit_destruction.7z  
  (`independent_nu_ljudbank-wood_crack_hit_destruction.7z`, 3,855,318 bytes, SHA-256 `2f9723be0147c32ea07db8ef7406229fb8f1a6ce8feabdf0dbf2dc5ee2aacd1a`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/sfx-base/sfx_fence_break_b.ogg` (1.65초) | wood_impact/crack01.mp3.flac | 원본 0.00–1.90초 구간만 사용; 앞뒤 무음 0.25초 제거; 직류 성분 제거; 0.3초 페이드아웃; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |

### 75 CC0 breaking / falling / hit sfx

- 작가: [rubberduck](https://opengameart.org/users/rubberduck)
- 출처 페이지: https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx
- 원본 파일: https://opengameart.org/sites/default/files/sfx_breaking_and_falling.zip  
  (`sfx_breaking_and_falling.zip`, 1,624,406 bytes, SHA-256 `e6ee04d91c5f4d30cfda1260d2c9d1faf96fda36319287215fbd07bcb1a80451`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/sfx-impact/sfx_hit_wall_a.ogg` (0.12초) | bfh1_hit_05.ogg | 앞뒤 무음 0.16초 제거; 직류 성분 제거; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-impact/sfx_hit_wall_b.ogg` (0.23초) | bfh1_hit_10.ogg | 앞뒤 무음 0.07초 제거; 직류 성분 제거; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-base/sfx_fence_break_a.ogg` (1.01초) | bfh1_breaking_01.ogg | 앞뒤 무음 0.05초 제거; 직류 성분 제거; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |

### 100 CC0 metal and wood SFX

- 작가: [rubberduck](https://opengameart.org/users/rubberduck)
- 출처 페이지: https://opengameart.org/content/100-cc0-metal-and-wood-sfx
- 원본 파일: https://opengameart.org/sites/default/files/100-CC0-wood-metal-SFX.zip  
  (`100-CC0-wood-metal-SFX.zip`, 1,990,361 bytes, SHA-256 `be6eba63b03409ac0c77787a956b1503a7c186403d04aef9725c52644a4b7878`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/sfx-impact/sfx_hit_armor_a.ogg` (0.35초) | metal_hit_02.ogg | 앞뒤 무음 0.08초 제거; 직류 성분 제거; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-base/sfx_fence_hit_a.ogg` (0.43초) | wood_slam_02.ogg | 앞뒤 무음 0.05초 제거; 직류 성분 제거; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-base/sfx_fence_hit_b.ogg` (0.43초) | metal_slam_01.ogg | 앞뒤 무음 0.14초 제거; 직류 성분 제거; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-base/sfx_repair_c.ogg` (0.30초) | hammer_01.ogg | 앞뒤 무음 0.20초 제거; 직류 성분 제거; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |

### 80 CC0 creture SFX #2

- 작가: [rubberduck](https://opengameart.org/users/rubberduck)
- 출처 페이지: https://opengameart.org/content/80-cc0-creture-sfx-2
- 원본 파일: https://opengameart.org/sites/default/files/80-CC0-creature-sfx-2.zip  
  (`80-CC0-creature-sfx-2.zip`, 1,890,174 bytes, SHA-256 `6d251aeaaaa9c2fffed8fc2f64bab3104725ceabf9259a8441994e7a20cfe22f`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/sfx-boss/sfx_boss_stomp_b.ogg` (0.45초) | stomp_01.ogg | 앞뒤 무음 0.01초 제거; 직류 성분 제거; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |

### Zombies Sound Pack

- 작가: [artisticdude](https://opengameart.org/users/artisticdude)
- 출처 페이지: https://opengameart.org/content/zombies-sound-pack
- 원본 파일: https://opengameart.org/sites/default/files/zombies.zip  
  (`zombies.zip`, 4,667,201 bytes, SHA-256 `8096ceeb4dac35d9eef9bfe0cc6649778d1eebf141b208d394ac338b9e5be314`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/sfx-zombie/sfx_zombie_groan_2.ogg` (1.54초) | zombies/zombie-17.wav | 앞뒤 무음 0.04초 제거; 직류 성분 제거; 0.25초 페이드아웃; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |

### Zombie moans

- 작가: [Darsycho](https://opengameart.org/users/darsycho)
- 출처 페이지: https://opengameart.org/content/zombie-moans
- 원본 파일: https://opengameart.org/sites/default/files/darsycho__zombie-moans_0.ogg  
  (`darsycho__zombie-moans.ogg`, 181,933 bytes, SHA-256 `49b0bd7a7908f2b3ea61ae93ccf584ab650705d62e8ed6d4c8c9f5b98ad37b05`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)
- 작가의 말: "Feel free to use for whatever, credit is appreciated!"

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/sfx-zombie/sfx_zombie_groan_3.ogg` (3.14초) | darsycho__zombie-moans.ogg | 파일 안의 소리 5개 중 1번째만 사용; 직류 성분 제거; 0.3초 페이드아웃; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-zombie/sfx_zombie_groan_6.ogg` (2.71초) | darsycho__zombie-moans.ogg | 원본 6.50–9.22초 구간만 사용; 직류 성분 제거; 0.3초 페이드아웃; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |

### Big scary troll sounds

- 작가: [Darsycho](https://opengameart.org/users/darsycho)
- 출처 페이지: https://opengameart.org/content/big-scary-troll-sounds
- 원본 파일: https://opengameart.org/sites/default/files/troll-roars_0.ogg  
  (`troll-roars.ogg`, 126,464 bytes, SHA-256 `7dc09cc3c3e424b66ac564ac83ac89ee91885c964780694d13f2c4957ac813c7`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)
- 작가의 말: "Feel free to use for whatever, credit is appreciated!"

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/sfx-boss/sfx_boss_roar_a.ogg` (1.76초) | troll-roars.ogg | 파일 안의 소리 6개 중 5번째만 사용; 직류 성분 제거; 0.2초 페이드아웃; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |

### Zombie Moans 01 - By EmoPreben

- 작가: [EmoPreben](https://opengameart.org/users/emopreben)
- 출처 페이지: https://opengameart.org/content/zombie-moans-01-by-emopreben
- 원본 파일: https://opengameart.org/sites/default/files/zombiemoans_-_wav.zip  
  (`zombiemoans_-_wav.zip`, 732,642 bytes, SHA-256 `013633f44207d221fbf764c4ecfd3f1a7c158423b7410f0e49527dd8c2f13df1`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/sfx-zombie/sfx_zombie_groan_1.ogg` (2.13초) | ZombieMoans - Track 5 - ZombieMoan1.wav | 직류 성분 제거; 0.25초 페이드아웃; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |

### Zombie noises and moans

- 작가: [ianzazz](https://opengameart.org/users/ianzazz)
- 출처 페이지: https://opengameart.org/content/zombie-noises-and-moans
- 원본 파일: https://opengameart.org/sites/default/files/zombienoises.zip  
  (`zombienoises.zip`, 223,566 bytes, SHA-256 `d2c90ad199ab95396dd7f5d21083b3bb7be7090a9b4a97ce7173233c6fcc72d6`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/sfx-zombie/sfx_zombie_groan_5.ogg` (2.12초) | zombienoise1.ogg | 직류 성분 제거; 0.3초 페이드아웃; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |

### Undead Moans

- 작가: [AntumDeluge](https://opengameart.org/users/antumdeluge)
- 출처 페이지: https://opengameart.org/content/undead-moans
- 원본 파일: https://opengameart.org/sites/default/files/undead-moans.zip  
  (`undead-moans.zip`, 96,239 bytes, SHA-256 `013d2327338585d950e3d55422ec0233b443ed888cdbf9908961502690bbe67e`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/sfx-zombie/sfx_zombie_groan_4.ogg` (1.84초) | undead-2.ogg | 원본 0.00–1.84초 구간만 사용; 직류 성분 제거; 0.25초 페이드아웃; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |

### Zombie / Skeleton / Monster Voice Effects

- 작가: [ArcadeParty](https://opengameart.org/users/arcadeparty)
- 출처 페이지: https://opengameart.org/content/zombie-skeleton-monster-voice-effects
- 원본 파일: https://opengameart.org/sites/default/files/Voice%20Effects%20Zombie-Skeleton-Monster%20Human%20Male.zip  
  (`Voice Effects Zombie-Skeleton-Monster Human Male.zip`, 2,047,881 bytes, SHA-256 `041ef356efc5d947db903530d68eb55b7e6fbfb77b96fdd092ab81eb8be59d57`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/sfx-zombie/sfx_zombie_death_1.ogg` (0.64초) | Voice Effects Zombie-Skeleton-Monster Human Male/zombieDeath1.wav | 직류 성분 제거; 0.08초 페이드아웃; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-zombie/sfx_zombie_death_2.ogg` (0.62초) | Voice Effects Zombie-Skeleton-Monster Human Male/zombieDeath2.wav | 직류 성분 제거; 0.08초 페이드아웃; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-zombie/sfx_zombie_death_3.ogg` (0.81초) | Voice Effects Zombie-Skeleton-Monster Human Male/zombieDeath3.wav | 직류 성분 제거; 0.08초 페이드아웃; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-zombie/sfx_zombie_death_4.ogg` (0.76초) | Voice Effects Zombie-Skeleton-Monster Human Male/zombieDeath4.wav | 앞뒤 무음 0.01초 제거; 직류 성분 제거; 0.08초 페이드아웃; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |

### Monster Sound Pack, Volume 1

- 작가: [Ogrebane](https://opengameart.org/users/ogrebane)
- 출처 페이지: https://opengameart.org/content/monster-sound-pack-volume-1
- 원본 파일: https://opengameart.org/sites/default/files/monster-sounds-volume-2.zip  
  (`monster-sounds-volume-2.zip`, 2,024,392 bytes, SHA-256 `f23b5691ac502cf03b58a353cb31f53e3cb93aeb65e654efc8482fd1829d7ef6`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/sfx-boss/sfx_boss_roar_b.ogg` (1.11초) | Monster-Sounds-Volume-2/Monster-2.wav | ffmpeg 필터 적용: asetrate=33075,aresample=44100; 앞뒤 무음 0.06초 제거; 직류 성분 제거; 0.2초 페이드아웃; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |

### CC0 Deep Monster Roar

- 작가: [trazzz123](https://opengameart.org/users/trazzz123)
- 출처 페이지: https://opengameart.org/content/cc0-deep-monster-roar
- 원본 파일: https://opengameart.org/sites/default/files/monster_roar.wav  
  (`monster_roar.wav`, 1,273,958 bytes, SHA-256 `040d2841619c732098c30a638731317d13d7647e5ce1a75a3246219ce4b162ff`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/sfx-boss/sfx_boss_roar_c.ogg` (3.89초) | monster_roar.wav | 원본 0.00–4.00초 구간만 사용; 앞뒤 무음 0.11초 제거; 직류 성분 제거; 1.2초 페이드아웃; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |

### Their Coming (generic horn sound)

- 작가: [StumpyStrust](https://opengameart.org/users/stumpystrust)
- 출처 페이지: https://opengameart.org/content/their-coming-generic-horn-sound
- 원본 파일: https://opengameart.org/sites/default/files/theircoming3_0.ogg  
  (`theircoming3.ogg`, 119,570 bytes, SHA-256 `4f2e3500b4f06470727012e36709931d3edfc186d78999cee59674a521d06538`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)
- 작가의 말: "Link to Opengameart maybe."

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/sfx-misc/sfx_raid_b.ogg` (4.95초) | theircoming3.ogg | 원본 0.00–4.95초 구간만 사용; 직류 성분 제거; 0.5초 페이드아웃; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |

### Sirens and Alarm Noise

- 작가: [aquinn](https://opengameart.org/users/aquinn)
- 출처 페이지: https://opengameart.org/content/sirens-and-alarm-noise
- 원본 파일: https://opengameart.org/sites/default/files/siren_0.mp3  
  (`siren.mp3`, 661,211 bytes, SHA-256 `fabe96ad2116d310b38acc143780e1c47c3cb27227deda13f84ce8e3cfb2248b`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/sfx-misc/sfx_raid_c.ogg` (2.46초) | siren.mp3 | 원본 0.00–2.60초 구간만 사용; 앞뒤 무음 0.14초 제거; 직류 성분 제거; 0.4초 페이드아웃; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |

### Short alarm

- 작가: [yd](https://opengameart.org/users/yd)
- 출처 페이지: https://opengameart.org/content/short-alarm
- 원본 파일: https://opengameart.org/sites/default/files/alarm_0.ogg  
  (`alarm.ogg`, 27,529 bytes, SHA-256 `dc76a67748c9cef0b91913fafbe47cf8ee4499c4f813dbe12e028d2806f1eab8`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/sfx-ui/sfx_ui_warning_b.ogg` (1.46초) | alarm.ogg | 앞뒤 무음 0.25초 제거; 직류 성분 제거; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |

### 68 Workshop Sounds

- 작가: [bart](https://opengameart.org/users/bart)
- 출처 페이지: https://opengameart.org/content/68-workshop-sounds
- 원본 파일: https://opengameart.org/sites/default/files/workshop.7z  
  (`workshop.7z`, 24,571,012 bytes, SHA-256 `79d7801041b5fbc8e181d9aaaa8dafb94b68bb51f325017e82fb37448e2fb1d3`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/sfx-boss/sfx_boss_stomp_a.ogg` (0.53초) | workshop/workshop - wood on wood thuds.wav | 파일 안의 소리 13개 중 2번째만 사용; 직류 성분 제거; 0.15초 페이드아웃; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-base/sfx_repair_a.ogg` (1.59초) | workshop/workshop - metal hammering 3.wav | 원본 0.00–1.70초 구간만 사용; 앞뒤 무음 0.11초 제거; 직류 성분 제거; 0.06초 페이드아웃; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-base/sfx_repair_b.ogg` (1.24초) | workshop/workshop - wood hammering.wav | 원본 0.00–1.45초 구간만 사용; 앞뒤 무음 0.21초 제거; 직류 성분 제거; 0.06초 페이드아웃; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-base/sfx_build_a.ogg` (1.90초) | workshop/workshop - drill short 1.wav | 직류 성분 제거; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-base/sfx_build_b.ogg` (2.39초) | workshop/workshop - drill2.wav | 원본 0.00–2.60초 구간만 사용; 앞뒤 무음 0.21초 제거; 직류 성분 제거; 0.3초 페이드아웃; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-gacha/sfx_gacha_roll_b.ogg` (1.82초) | workshop/workshop - ratchet2.wav | 원본 0.00–1.90초 구간만 사용; 앞뒤 무음 0.08초 제거; 직류 성분 제거; 0.2초 페이드아웃; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |

### Chimey UI Sounds

- 작가: [MouseBYTE](https://opengameart.org/users/mousebyte)
- 출처 페이지: https://opengameart.org/content/chimey-ui-sounds
- 원본 파일: https://opengameart.org/sites/default/files/mousebyte_chimeyui.7z  
  (`mousebyte_chimeyui.7z`, 382,290 bytes, SHA-256 `6272bac49c8f3e9aa251a8c9e974a2e7f5756119657d0414197baeb129b0c549`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)
- 작가의 말: "No rights reserved, no credit needed."

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/sfx-ui/sfx_ui_levelup_b.ogg` (1.62초) | Chime_LevelUp.mp3 | 앞뒤 무음 0.16초 제거; 직류 성분 제거; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |

### UI Sound Effects (Button Clicks, User Feedback, Notifications)

- 작가: [Robin Lamb](https://opengameart.org/users/robin-lamb)
- 출처 페이지: https://opengameart.org/content/ui-sound-effects-button-clicks-user-feedback-notifications
- 원본 파일: https://opengameart.org/sites/default/files/ui_wav.zip  
  (`ui_wav.zip`, 1,364,100 bytes, SHA-256 `8e4e23dd4ec501776dab1428c5f1e405b5065e296518feb04816f2892d163053`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)
- 페이지 설명: 퍼블릭 도메인(CC0) 악기 샘플 라이브러리 VCSL, VSCO 2 CE의 소리를 Audacity로 다듬은 것.

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/sfx-ui/sfx_ui_button_b.ogg` (0.20초) | ui_wav/click_3.wav | 앞뒤 무음 0.01초 제거; 직류 성분 제거; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-ui/sfx_ui_tab_b.ogg` (0.22초) | ui_wav/click_2.wav | 직류 성분 제거; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-ui/sfx_ui_notify_b.ogg` (0.65초) | ui_wav/Ding.wav | 앞뒤 무음 0.35초 제거; 직류 성분 제거; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |

### Level up, power up, Coin get (13 Sounds)

- 작가: [wobbleboxx](https://opengameart.org/users/wobbleboxx)
- 출처 페이지: https://opengameart.org/content/level-up-power-up-coin-get-13-sounds
- 원본 파일: https://opengameart.org/sites/default/files/SoundPack01.zip  
  (`SoundPack01.zip`, 6,780,792 bytes, SHA-256 `b3405c1c98f5223c101fdbfd445903c0b558ebb325b85306964d64a34ef82db3`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)
- 작가의 말: "This pack is released under the public domain CC0 license. If you want to give credit (not required): "WobbleBoxx Workshop""

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/sfx-base/sfx_breakthrough_b.ogg` (2.32초) | Rise05.aif | 원본 0.00–3.00초 구간만 사용; 앞뒤 무음 0.68초 제거; 직류 성분 제거; 0.5초 페이드아웃; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |

### Gem collect SFX

- 작가: [Bobjt](https://opengameart.org/users/bobjt)
- 출처 페이지: https://opengameart.org/content/gem-collect-sfx
- 원본 파일: https://opengameart.org/sites/default/files/gem-gather-stereo-reverb.wav  
  (`gem-gather-stereo-reverb.wav`, 398,572 bytes, SHA-256 `2d44fbb79f0839b8450e570a076154822b53ab31987ed2e8590d42792eb0a4d3`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/sfx-misc/sfx_relic_b.ogg` (1.00초) | gem-gather-stereo-reverb.wav | 앞뒤 무음 0.50초 제거; 직류 성분 제거; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |

### 80 CC0 RPG SFX

- 작가: [rubberduck](https://opengameart.org/users/rubberduck)
- 출처 페이지: https://opengameart.org/content/80-cc0-rpg-sfx
- 원본 파일: https://opengameart.org/sites/default/files/80-CC0-RPG-SFX_0.zip  
  (`80-CC0-RPG-SFX.zip`, 1,845,114 bytes, SHA-256 `1c2f06ff4e8563b5b8b745b23cf213c1474142a69bb82bd8f5e10d9b3f7a7bbd`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/sfx-ui/sfx_ui_purchase_b.ogg` (0.60초) | item_coins_02.ogg | 앞뒤 무음 0.04초 제거; 직류 성분 제거; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |

### 7 Assorted Sound Effects (Menu, Level Up)

- 작가: [Joth](https://opengameart.org/users/joth)
- 출처 페이지: https://opengameart.org/content/7-assorted-sound-effects-menu-level-up
- 원본 파일: https://opengameart.org/sites/default/files/UISoundEffects.zip  
  (`UISoundEffects.zip`, 627,912 bytes, SHA-256 `a04c6ea7d7b378949733365410b5141ca7fcfc4ee270be322773d8d69911012d`)
- 라이선스: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (페이지의 라이선스란에 CC0만 표시)
- 받은 날: 2026-11-02 / 페이지 재확인: 2026-11-02 (이상 없음)
- 작가의 말: "Credit to Joth, link to opengameart.org/users/joth, or link to @Joth_Music twitter.com/Joth_Music. Appreciated but not required."

| 만든 파일 | 원본 안의 파일 | 가공 |
|---|---|---|
| `candidates/sfx-ui/sfx_ui_clear_b.ogg` (3.18초) | Level Up.mp3 | 원본 0.00–3.20초 구간만 사용; 앞뒤 무음 0.02초 제거; 직류 성분 제거; 0.6초 페이드아웃; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |

## 생성 (자체 합성)

- 만든 곳: `bunker/audio/tools/synth.mjs` (node, 의존성 없음). 같은 코드는 항상 같은 소리를 만듭니다.
- 외부 샘플, 녹음, 프리셋을 쓰지 않았습니다. 이 프로젝트의 결과물이므로 별도 라이선스 조건이 없습니다.
- 만든 날: 2026-11-02

| 만든 파일 | 합성 내용 | 가공 |
|---|---|---|
| `candidates/sfx-gun/sfx_gun_flame_b.ogg` (1.61초) | 점화 후 으르렁대는 불길, 지직거리는 불꽃. | 직류 성분 제거; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-gun/sfx_gun_electric_c.ogg` (0.66초) | 빠르게 떨어지는 소리와 지직거림, 낮은 쿵. | 앞뒤 무음 0.15초 제거; 직류 성분 제거; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-reload/sfx_casing_a.ogg` (0.52초) | 황동 탄피가 바닥에 세 번 튕김. | 직류 성분 제거; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-boss/sfx_boss_stomp_c.ogg` (1.01초) | 중음 쿵과 저음 낙하, 짧은 먼지 소리. | 직류 성분 제거; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-base/sfx_breakthrough_a.ogg` (1.96초) | 짧은 도입 후 큰 화음, 스네어와 심벌. | 앞뒤 무음 0.14초 제거; 직류 성분 제거; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-ui/sfx_ui_button_a.ogg` (0.07초) | 짧고 부드러운 사각파. | 직류 성분 제거; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-ui/sfx_ui_tab_a.ogg` (0.10초) | 두 음의 가벼운 틱. | 직류 성분 제거; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-ui/sfx_ui_purchase_a.ogg` (0.60초) | 동전 "챙", 두 음과 반짝임. | 직류 성분 제거; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-ui/sfx_ui_levelup_a.ogg` (1.22초) | 올라가는 아르페지오와 길게 끄는 높은 음. | 앞뒤 무음 0.18초 제거; 직류 성분 제거; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-ui/sfx_ui_clear_a.ogg` (1.60초) | 상승 음 뒤 C장조 화음, 가벼운 드럼. | 앞뒤 무음 0.19초 제거; 직류 성분 제거; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-ui/sfx_ui_warning_a.ogg` (0.70초) | 두 음 경보를 두 번. | 직류 성분 제거; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-ui/sfx_ui_notify_a.ogg` (1.22초) | 두 음의 부드러운 종소리. | 앞뒤 무음 0.16초 제거; 직류 성분 제거; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-gacha/sfx_gacha_roll_a.ogg` (1.71초) | 점점 빨라지는 딸깍과 북소리, 마지막에 상승. | 직류 성분 제거; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-gacha/sfx_reveal_1.ogg` (0.17초) | 중립적인 작은 "퐁". | 직류 성분 제거; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-gacha/sfx_reveal_2.ogg` (0.75초) | 밝은 두 음이 올라감. | 직류 성분 제거; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-gacha/sfx_reveal_3.ogg` (1.34초) | 아르페지오와 반짝임 몇 개. | 직류 성분 제거; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-gacha/sfx_reveal_4.ogg` (1.80초) | 휙 하는 소리 뒤 D장조 아르페지오와 화음. | 앞뒤 무음 0.11초 제거; 직류 성분 제거; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-gacha/sfx_reveal_5.ogg` (1.94초) | 상승음, 충격, 금관 화음, 반짝이는 소리. | 앞뒤 무음 0.27초 제거; 직류 성분 제거; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-gacha/sfx_reveal_6.ogg` (2.77초) | 이중 충격, 저음과 큰 화음, 합창 패드. | 앞뒤 무음 0.21초 제거; 직류 성분 제거; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-gacha/sfx_reveal_7.ogg` (3.19초) | 긴 상승음, 충격, 종소리 폭포, 금관 화음. | 앞뒤 무음 0.26초 제거; 직류 성분 제거; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-gacha/sfx_reveal_8.ogg` (4.13초) | 가장 긴 상승, 거대한 충격, 무지개 음계, 합창과 종. | 앞뒤 무음 0.21초 제거; 직류 성분 제거; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-misc/sfx_relic_a.ogg` (1.44초) | 오음계 종소리가 빠르게 올라가고 부드러운 패드. | 앞뒤 무음 0.11초 제거; 직류 성분 제거; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
| `candidates/sfx-misc/sfx_raid_a.ogg` (2.35초) | 낮은 뿔피리와 북 두 번, 상승하는 경보. | 앞뒤 무음 0.23초 제거; 직류 성분 제거; 모노, 최대 음량 -1 dBTP로 맞춤; OGG Vorbis로 변환 |
