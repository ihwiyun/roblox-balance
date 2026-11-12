"""실기기 없이 돌리는 테스트. adb 출력은 실제 형식을 본뜬 가짜 값이다."""
import datetime as dt
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import phone_audit as pa  # noqa: E402

GETPROP = """\
[ro.product.manufacturer]: [samsung]
[ro.product.model]: [SM-S911N]
[ro.build.version.release]: [14]
[ro.build.version.security_patch]: [2024-01-01]
[ro.boot.verifiedbootstate]: [green]
[ro.boot.flash.locked]: [1]
[ro.debuggable]: [0]
[ro.build.tags]: [release-keys]
[ro.crypto.state]: [encrypted]
"""

PM_ALL = """\
package:com.android.settings  installer=null uid:1000
package:com.samsung.android.honeyboard  installer=null uid:10050
package:com.miui.analytics  installer=null uid:10051
package:com.kakao.talk  installer=com.android.vending uid:10200
package:com.zhiliaoapp.musically  installer=com.android.vending uid:10201
package:com.system.update.helper  installer=com.google.android.packageinstaller uid:10202
package:com.fake.bank  installer=null uid:10203
package:com.sohu.inputmethod.sogou  installer=com.android.vending uid:10204
"""
PM_THIRD = """\
package:com.kakao.talk
package:com.zhiliaoapp.musically
package:com.system.update.helper
package:com.fake.bank
package:com.sohu.inputmethod.sogou
"""

DUMPSYS_PACKAGE = """\
Packages:
  Package [com.kakao.talk] (1a2b3c):
    userId=10200
    versionCode=1 minSdk=26 targetSdk=34
    versionName=10.5.0
    firstInstallTime=2024-03-01 10:00:00
    install permissions:
      android.permission.INTERNET: granted=true
    User 0: ceDataInode=1 installed=true
      runtime permissions:
        android.permission.READ_CONTACTS: granted=true, flags=[ USER_SET ]
        android.permission.CAMERA: granted=false, flags=[ USER_SET ]
  Package [com.zhiliaoapp.musically] (aa):
    versionName=33.0
    runtime permissions:
        android.permission.CAMERA: granted=true
        android.permission.RECORD_AUDIO: granted=true
        android.permission.READ_CONTACTS: granted=true
  Package [com.system.update.helper] (bb):
    versionName=1.0
    firstInstallTime=2025-05-05 03:00:00
    runtime permissions:
        android.permission.READ_SMS: granted=true
        android.permission.RECEIVE_SMS: granted=true
        android.permission.ACCESS_BACKGROUND_LOCATION: granted=true
  Package [com.fake.bank] (cc):
    runtime permissions:
        android.permission.READ_SMS: granted=true
  Package [com.sohu.inputmethod.sogou] (dd):
    versionName=1

Shared users:
  SharedUser [android.uid.system] (ee):
    install permissions:
      android.permission.READ_SMS: granted=true
"""

DEVICE_POLICY = """\
Current Device Policy Manager state:
  Enabled Device Admins (User 0, provisioningState: 0):
    com.google.android.gms/.mdm.receivers.MdmDeviceAdminReceiver:
      uid=10100
    com.system.update.helper/.AdminReceiver:
      uid=10202
"""

LAUNCHER = """\
6 activities found:
  priority=0 preferredOrder=0 match=0x108000 specificIndex=-1 isDefault=true
  com.android.settings/.Settings
  priority=0 preferredOrder=0 match=0x108000 specificIndex=-1 isDefault=true
  com.kakao.talk/.activity.SplashActivity
  com.zhiliaoapp.musically/com.ss.android.ugc.aweme.splash.SplashActivity
  com.fake.bank/.Main
  com.sohu.inputmethod.sogou/.Main
  com.samsung.android.app.notes/.Main
"""

NETSTATS = """\
Active interfaces:
  iface=wlan0 ident=[{type=WIFI}]
Dev stats:
  ident=[{type=WIFI}] uid=-1 set=ALL tag=0x0
    NetworkStatsHistory: bucketDuration=3600
      st=1700000000 rb=999999999 rp=1 tb=999999999 tp=1 op=0
UID stats:
  Pending bytes: 0
  ident=[{type=WIFI, subType=COMBINED}] uid=10202 set=DEFAULT tag=0x0
    NetworkStatsHistory: bucketDuration=7200
      st=1700000000 rb=1000000 rp=10 tb=200000000 tp=12 op=0
      st=1700007200 rb=1000000 rp=10 tb=100000000 tp=12 op=0
  ident=[{type=WIFI, subType=COMBINED}] uid=10200 set=FOREGROUND tag=0x0
    NetworkStatsHistory: bucketDuration=7200
      st=1700000000 rb=500000000 rp=10 tb=1000000 tp=12 op=0
UID tag stats:
  ident=[{type=WIFI}] uid=10200 set=FOREGROUND tag=0xffffff01
    NetworkStatsHistory: bucketDuration=7200
      st=1700000000 rb=777 rp=10 tb=777 tp=12 op=0
"""


class FakeAdb:
    """명령 문자열의 앞부분으로 가짜 출력을 돌려준다."""
    TABLE = [
        ("getprop", GETPROP),
        ("settings get global package_verifier_user_consent", "-1\n"),
        ("settings get global http_proxy", "192.168.0.9:8888\n"),
        ("settings get global private_dns_mode", "off\n"),
        ("settings get secure always_on_vpn_app", "null\n"),
        ("settings get secure enabled_accessibility_services",
         "com.system.update.helper/.Svc:com.kakao.talk/.A11y\n"),
        ("settings get secure enabled_notification_listeners", "com.system.update.helper/.NL\n"),
        ("settings get secure default_input_method", "com.sohu.inputmethod.sogou/.SogouIME\n"),
        ("which su", ""),
        ("ls /data/misc/user/0/cacerts-added",
         "ls: /data/misc/user/0/cacerts-added: Permission denied\n"),
        ("pm list packages -i -U", PM_ALL),
        ("pm list packages -3", PM_THIRD),
        ("dumpsys package", DUMPSYS_PACKAGE),
        ("dumpsys device_policy", DEVICE_POLICY),
        ("cmd package query-activities", LAUNCHER),
        ("appops query-op SYSTEM_ALERT_WINDOW", "com.system.update.helper\ncom.kakao.talk\n"),
        ("appops query-op", "No operations.\n"),
        ("dumpsys netstats detail", NETSTATS),
    ]

    def shell(self, cmd, timeout=60):
        for prefix, out in self.TABLE:
            if cmd.startswith(prefix):
                return out
        return ""


def titles(rep, sev=None):
    return [f["title"] for f in rep.findings if sev is None or f["sev"] == sev]


class ParserTests(unittest.TestCase):
    def test_classify_domain(self):
        self.assertEqual(pa.classify_domain("log.snssdk.com")[0], "cn")
        self.assertEqual(pa.classify_domain("a.b.example.cn")[0], "cn")
        self.assertEqual(pa.classify_domain("mc.yandex.ru")[0], "ru")
        self.assertEqual(pa.classify_domain("graph.facebook.com")[0], "tracker")
        self.assertIsNone(pa.classify_domain("www.facebook.com"))
        self.assertIsNone(pa.classify_domain("notqq.com.example.org"))
        self.assertIsNone(pa.classify_domain("fakebaidu.com"))
        self.assertEqual(pa.classify_domain("cdn.example.net", "CN")[0], "cn")

    def test_watch_label(self):
        self.assertIn("TikTok", pa.watch_label("com.zhiliaoapp.musically"))
        self.assertEqual(pa.watch_label("com.tencent.mm"), "Tencent")
        self.assertEqual(pa.watch_label("com.miHoYo.GenshinImpact"), "miHoYo")
        self.assertIsNone(pa.watch_label("com.kakao.talk"))
        self.assertIsNone(pa.watch_label("com.microsoft.office"))

    def test_pm_list(self):
        p = pa.parse_pm_list(PM_ALL)
        self.assertEqual(p["com.kakao.talk"], {"installer": "com.android.vending", "uid": 10200})
        self.assertIsNone(p["com.fake.bank"]["installer"])

    def test_dumpsys_package(self):
        d = pa.parse_dumpsys_package(DUMPSYS_PACKAGE)
        self.assertEqual(d["com.kakao.talk"]["perms"],
                         {"android.permission.INTERNET", "android.permission.READ_CONTACTS"})
        self.assertEqual(d["com.kakao.talk"]["target_sdk"], "34")
        # Shared users 구역의 권한이 마지막 패키지에 섞여 들어가면 안 된다
        self.assertEqual(d["com.sohu.inputmethod.sogou"]["perms"], set())

    def test_netstats(self):
        u = pa.parse_netstats(NETSTATS)
        self.assertEqual(u[10202], {"rx": 2000000, "tx": 300000000, "bg_tx": 300000000})
        self.assertEqual(u[10200], {"rx": 500000000, "tx": 1000000, "bg_tx": 0})
        self.assertNotIn(-1, u)

    def test_device_policy_and_launcher(self):
        admins, owners = pa.parse_device_policy(DEVICE_POLICY)
        self.assertEqual(admins, {"com.google.android.gms", "com.system.update.helper"})
        self.assertEqual(owners, set())
        _, owners = pa.parse_device_policy(
            "  Device Owner:\n    admin=ComponentInfo{com.evil.mdm/com.evil.mdm.R}\n")
        self.assertEqual(owners, {"com.evil.mdm"})
        self.assertNotIn("com.system.update.helper", pa.parse_launcher(LAUNCHER))
        self.assertIn("com.kakao.talk", pa.parse_launcher(LAUNCHER))

    def test_load_ioc(self):
        with tempfile.TemporaryDirectory() as d:
            y = os.path.join(d, "ioc.yaml")
            with open(y, "w") as fh:
                fh.write("- name: SpyThing\n  names:\n  - SpyThing\n  packages:\n"
                         "  - com.system.update.helper\n  websites:\n  - spything.com\n")
            self.assertEqual(pa.load_ioc(y), {"com.system.update.helper": "SpyThing"})
            t = os.path.join(d, "ioc.txt")
            with open(t, "w") as fh:
                fh.write("# 메모\ncom.a.b\n\ncom.c.d\n")
            self.assertEqual(set(pa.load_ioc(t)), {"com.a.b", "com.c.d"})


class AndroidAuditTests(unittest.TestCase):
    def setUp(self):
        self.rep = pa.android_audit(FakeAdb(), ioc={"com.system.update.helper": "SpyThing"},
                                    today=dt.date(2026, 11, 12))

    def test_high_findings(self):
        high = "\n".join(titles(self.rep, "HIGH"))
        self.assertIn("보안 패치", high)                       # 34개월 전
        self.assertIn("전역 프록시", high)
        self.assertIn("스토커웨어와 일치: com.system.update.helper", high)
        self.assertIn("접근성 권한 보유: com.system.update.helper", high)
        self.assertNotIn("com.kakao.talk", high)

    def test_medium_and_low(self):
        med = "\n".join(titles(self.rep, "MED"))
        self.assertIn("Play 프로텍트", med)
        self.assertIn("접근성 권한을 가진 앱: com.kakao.talk", med)
        self.assertIn("기기 관리자 권한을 가진 앱: com.system.update.helper", med)
        self.assertIn("비공식 설치 앱이 문자(SMS) 권한 보유: com.fake.bank", med)
        self.assertIn("서드파티 키보드 사용 중: com.sohu.inputmethod.sogou", med)
        self.assertNotIn("부트로더", med)
        low = {f["title"]: f for f in self.rep.findings if f["sev"] == "LOW"}
        self.assertIn("스토어를 거치지 않고 설치된 앱 2개", low)
        self.assertIn("com.zhiliaoapp.musically", low["중국 본사 기업의 앱 2개 (사용자 설치)"]["detail"])
        self.assertIn("com.system.update.helper", low["받은 것보다 보낸 데이터가 많은 앱"]["detail"])

    def test_tables_and_outputs(self):
        apps = self.rep.tables[0]
        self.assertTrue(apps["rows"][0][0].startswith("com.system.update.helper"))
        self.assertIn("아이콘 없음", apps["rows"][0][3])
        net = self.rep.tables[1]
        self.assertEqual(net["rows"][0][:2], ["com.system.update.helper", "286.1MB"])
        self.assertTrue(any("사용자 인증서" in s for s in self.rep.skipped))
        page = self.rep.to_html()
        self.assertIn("com.system.update.helper", page)
        self.assertIn("</html>", page)
        self.assertIn("[위험]", self.rep.to_text())
        self.assertIn('"HIGH"', self.rep.to_json())


class FlowTests(unittest.TestCase):
    def _write(self, name, body):
        d = tempfile.mkdtemp()
        p = os.path.join(d, name)
        with open(p, "w", encoding="utf-8") as fh:
            fh.write(body)
        return p

    def test_ios_report(self):
        p = self._write("r.ndjson", "\n".join([
            '{"type":"networkActivity","bundleID":"com.game.fun","domain":"log.umeng.com","hits":12,"timeStamp":"2026-11-01T10:00:00Z"}',
            '{"type":"networkActivity","bundleID":"com.game.fun","domain":"app-measurement.com","hits":3,"timeStamp":"2026-11-03T10:00:00Z"}',
            '{"type":"networkActivity","bundleID":"com.zhiliaoapp.musically","domain":"api.tiktokv.com","hits":50}',
            '{"type":"networkActivity","bundleID":"com.apple.news","domain":"apple.com","hits":5}',
            '{"type":"access","accessor":{"identifier":"com.zhiliaoapp.musically","identifierType":"bundleID"},"category":"location","kind":"intervalBegin","timeStamp":"2026-11-02T10:00:00Z"}',
            '{"type":"access","accessor":{"identifier":"com.zhiliaoapp.musically","identifierType":"bundleID"},"category":"location","kind":"intervalEnd"}',
            'not json',
        ]))
        rep = pa.ios_report(p)
        t = {f["title"]: f for f in rep.findings}
        self.assertEqual(t["com.game.fun: 중국 기업/소재 도메인 1곳과 통신"]["sev"], "LOW")
        self.assertEqual(t["com.zhiliaoapp.musically: 중국 기업/소재 도메인 1곳과 통신"]["sev"], "INFO")
        self.assertIn("위치 1회", t["com.zhiliaoapp.musically (TikTok (ByteDance)): 민감 데이터 접근 1회"]["detail"])
        self.assertFalse(any("com.apple.news" in k for k in t))
        self.assertIn(("기간", "2026-11-01 ~ 2026-11-03"), rep.meta)
        self.assertEqual(rep.skipped, ["읽지 못한 줄 1개"])

    def test_pcapdroid_csv(self):
        p = self._write("p.csv",
                        "IPProto,SrcIP,SrcPort,DstIp,DstPort,UID,App,Proto,Status,Info,BytesSent,BytesRcvd\n"
                        "6,10.0.0.2,1,1.2.3.4,443,10200,Fun Game,TLS,Closed,sdk.e.qq.com,20000000,100\n"
                        "6,10.0.0.2,1,1.2.3.4,443,10200,Fun Game,TLS,Closed,sdk.e.qq.com,5000,100\n"
                        "6,10.0.0.2,1,5.6.7.8,443,10201,Chrome,TLS,Closed,www.naver.com,900,100\n"
                        "17,10.0.0.2,1,8.8.8.8,53,10201,Chrome,DNS,Closed,,50,100\n")
        rep = pa.netlog_report(p)
        f = [x for x in rep.findings if x["title"].startswith("Fun Game")][0]
        self.assertEqual(f["sev"], "MED")                     # 10MB 넘게 전송
        self.assertIn("2회", f["detail"])
        self.assertEqual(len(rep.findings), 1)
        self.assertIn("1건", rep.skipped[0])

    def test_nextdns_and_plain_list(self):
        p = self._write("n.csv", "timestamp,domain,query_type,destination_country,device_name\n"
                                 "t,cdn.somewhere.net,A,CN,phone\nt,kakao.com,A,KR,phone\n")
        rep = pa.netlog_report(p)
        self.assertEqual([f["title"] for f in rep.findings], ["phone: 중국 기업/소재 도메인 1곳과 통신"])
        p = self._write("d.txt", "# 목록\n0.0.0.0 mc.yandex.ru\nexample.org\n")
        rep = pa.netlog_report(p)
        self.assertEqual([f["title"] for f in rep.findings], ["(앱 미확인): 러시아 기업/소재 도메인 1곳과 통신"])


if __name__ == "__main__":
    unittest.main()
