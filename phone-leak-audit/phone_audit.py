#!/usr/bin/env python3
"""phone_audit.py - 휴대폰에서 무엇이 빠져나가는지 점검하는 로컬 도구.

외부 라이브러리 없이 파이썬 3.8+ 만으로 동작하고, 점검 결과를 어디에도 전송하지 않는다.

  python3 phone_audit.py android                  # 안드로이드 (USB 디버깅 / adb 필요)
  python3 phone_audit.py ios  리포트.ndjson        # 아이폰 '앱 개인정보 보호 리포트' 분석
  python3 phone_audit.py netlog 기록.csv           # PCAPdroid / NextDNS / 도메인 목록 분석
  python3 phone_audit.py checklist                # 도구로 볼 수 없는 항목 수동 점검표
"""
import argparse
import csv
import datetime as dt
import html
import ipaddress
import json
import os
import re
import subprocess
import sys
from collections import Counter, defaultdict

VERSION = "1.0"

# --------------------------------------------------------------------------
# 기준 데이터
# --------------------------------------------------------------------------

# 본사가 중국에 있는 회사의 앱. "악성"이라는 뜻이 아니라, 수집된 데이터가
# 중국 법(데이터 제출 요구 등)의 관할에 놓일 수 있다는 정보 표시다.
WATCH_PKG = {
    "com.zhiliaoapp.musically": "TikTok (ByteDance)",
    "com.zhiliaoapp.musically.go": "TikTok Lite (ByteDance)",
    "com.lemon.lvoverseas": "CapCut (ByteDance)",
    "com.einnovation.temu": "Temu (PDD)",
    "com.xunmeng.pinduoduo": "Pinduoduo (PDD)",
    "com.zzkko": "SHEIN",
    "com.taobao.taobao": "Taobao (Alibaba)",
    "com.eg.android.alipaygphone": "Alipay (Ant)",
    "com.ucmobile.intl": "UC Browser (Alibaba)",
    "com.lenovo.anyshare.gps": "SHAREit",
    "com.sina.weibo": "Weibo",
    "com.smile.gifmaker": "Kuaishou",
    "com.kwai.video": "Kwai (Kuaishou)",
    "com.intsig.camscanner": "CamScanner (INTSIG)",
    "cn.wps.moffice_eng": "WPS Office (Kingsoft)",
    "com.cleanmaster.mguard": "Clean Master (Cheetah Mobile)",
    "com.mt.mtxx.mtxx": "Meitu",
    "com.commsource.beautyplus": "BeautyPlus (Meitu)",
    "com.yy.hiyo": "Hago (JOYY)",
    "com.jingdong.app.mall": "JD.com",
    "com.sankuai.meituan": "Meituan",
    "com.autonavi.minimap": "Amap (Alibaba)",
    "com.mobile.legends": "Mobile Legends (Moonton/ByteDance)",
    "tv.danmaku.bili": "Bilibili",
    "com.qiyi.video": "iQIYI",
    "com.iqiyi.i18n": "iQIYI",
    "com.zhihu.android": "Zhihu",
    "com.sohu.inputmethod.sogou": "Sogou 키보드 (Tencent)",
    "com.iflytek.inputmethod": "iFlytek 키보드",
    "dji.go.v5": "DJI Fly",
    "com.tencent.xin": "WeChat (Tencent)",
}
WATCH_PREFIX = [
    ("com.tencent.", "Tencent"), ("com.ss.android.", "ByteDance"),
    ("com.bytedance.", "ByteDance"), ("com.alibaba.", "Alibaba"),
    ("com.baidu.", "Baidu"), ("com.netease.", "NetEase"),
    ("com.mihoyo.", "miHoYo"), ("com.hoyoverse.", "miHoYo"),
    ("com.xiaomi.", "Xiaomi"), ("com.miui.", "Xiaomi"), ("com.mi.", "Xiaomi"),
    ("com.huawei.", "Huawei"), ("com.hihonor.", "Honor"),
    ("com.oppo.", "OPPO"), ("com.heytap.", "OPPO"), ("com.coloros.", "OPPO"),
    ("com.oneplus.", "OnePlus"), ("com.realme.", "realme"),
    ("com.vivo.", "vivo"), ("com.bbk.", "vivo"), ("com.transsion.", "Transsion"),
    ("com.zte.", "ZTE"), ("com.dji.", "DJI"), ("com.cmcm.", "Cheetah Mobile"),
    ("com.meitu.", "Meitu"), ("com.lilithgame.", "Lilith Games"),
    ("com.kwai.", "Kuaishou"), ("com.duokan.", "Xiaomi"),
]

# 도메인 접미사 -> (분류, 소유자). 분류: cn / ru / tracker
_CN = {
    "Baidu": "baidu.com bdstatic.com bcebos.com",
    "Tencent": "qq.com tencent.com gtimg.com wechat.com myqcloud.com qcloud.com",
    "Alibaba": "alibaba.com alicdn.com aliyun.com aliyuncs.com alipay.com taobao.com "
               "tmall.com aliexpress.com mmstat.com umeng.com umengcloud.com amap.com "
               "autonavi.com ucweb.com",
    "ByteDance": "bytedance.com byteoversea.com ibytedtos.com ibyteimg.com snssdk.com "
                 "pstatp.com toutiao.com tiktok.com tiktokv.com tiktokcdn.com musical.ly "
                 "pangle.io pangolin-sdk-toutiao.com capcut.com",
    "PDD/Temu": "temu.com kwcdn.com pinduoduo.com yangkeduo.com",
    "SHEIN": "shein.com ltwebstatic.com",
    "Xiaomi": "xiaomi.com xiaomi.net mi.com miui.com",
    "Huawei": "huawei.com hicloud.com dbankcloud.com dbankcdn.com",
    "OPPO/vivo": "oppo.com oppomobile.com heytap.com heytapmobi.com coloros.com "
                 "realme.com vivo.com vivoglobal.com",
    "푸시/통계 SDK": "igexin.com getui.com mob.com talkingdata.com",
    "Mintegral": "mintegral.com mobvista.com rayjump.com",
    "NetEase": "163.com netease.com 126.net",
    "Sina": "sina.com weibo.com",
    "Bilibili": "bilibili.com hdslb.com",
    "Kuaishou": "kuaishou.com kwai.com",
    "기타 중국 기업": "iqiyi.com jd.com meituan.com sogou.com wps.com mihoyo.com "
                 "hoyoverse.com yy.com dji.com cmcm.com ksmobile.com meitu.com "
                 "ushareit.com transsion.com shalltry.com intsig.net camscanner.com",
}
_RU = {"Yandex": "yandex.ru yandex.net yandex.com", "VK/Mail.ru": "mail.ru my.com vk.com mradx.net"}
_TRACKER = {
    "Google 광고/분석": "google-analytics.com doubleclick.net googlesyndication.com "
                    "googleadservices.com app-measurement.com crashlytics.com",
    "Meta": "graph.facebook.com connect.facebook.net an.facebook.com",
    "AppsFlyer": "appsflyer.com appsflyersdk.com", "Adjust": "adjust.com adjust.io",
    "Branch": "branch.io", "Amplitude": "amplitude.com", "Mixpanel": "mixpanel.com",
    "Unity Ads": "unityads.unity3d.com", "AppLovin": "applovin.com applvn.com",
    "Vungle/Liftoff": "vungle.com liftoff.io", "ironSource": "ironsrc.mobi supersonicads.com",
    "InMobi": "inmobi.com", "Criteo": "criteo.com criteo.net",
    "광고 네트워크": "scorecardresearch.com moatads.com taboola.com outbrain.com adcolony.com "
                "chartboost.com tapjoy.com smaato.net pubmatic.com rubiconproject.com "
                "adnxs.com bidswitch.net amazon-adsystem.com mopub.com startappservice.com",
    "분석/마케팅 SDK": "kochava.com singular.net braze.com onesignal.com segment.io "
                  "segment.com flurry.com hotjar.com",
    "국내 광고 SDK": "igaworks.com tnkfactory.com cauly.co.kr cauly.net mobon.net dable.io",
}
DOMAIN_RULES = {}
for _cat, _groups in (("cn", _CN), ("ru", _RU), ("tracker", _TRACKER)):
    for _owner, _doms in _groups.items():
        for _d in _doms.split():
            DOMAIN_RULES[_d] = (_cat, _owner)
CAT_KO = {"cn": "중국", "ru": "러시아", "tracker": "광고·추적"}

# 정상적인 설치 경로(스토어, 제조사 사전설치, 기기 이전)
TRUSTED_INSTALLERS = {
    "com.android.vending": "Play 스토어",
    "com.sec.android.app.samsungapps": "갤럭시 스토어",
    "com.skt.skaf.A000Z00040": "원스토어",
    "com.kt.olleh.storefront": "원스토어(KT)",
    "com.lguplus.appstore": "원스토어(LG U+)",
    "com.amazon.venezia": "Amazon 앱스토어",
    "com.xiaomi.mipicks": "Xiaomi GetApps",
    "com.xiaomi.market": "Xiaomi 스토어",
    "com.huawei.appmarket": "Huawei AppGallery",
    "com.heytap.market": "OPPO 스토어",
    "com.oppo.market": "OPPO 스토어",
    "com.bbk.appstore": "vivo 스토어",
    "com.sec.android.preloadinstaller": "제조사 사전설치",
    "com.samsung.android.app.omcagent": "제조사/통신사 사전설치",
    "com.sec.android.easyMover": "Smart Switch 기기 이전",
    "com.google.android.apps.restore": "기기 이전(구글 복원)",
}

# 권한 -> (묶음 이름, 점수)
SENSITIVE_PERMS = {
    "android.permission.READ_SMS": ("문자", 2),
    "android.permission.RECEIVE_SMS": ("문자", 2),
    "android.permission.SEND_SMS": ("문자", 2),
    "android.permission.READ_CALL_LOG": ("통화기록", 1),
    "android.permission.READ_CONTACTS": ("연락처", 1),
    "android.permission.GET_ACCOUNTS": ("계정목록", 1),
    "android.permission.ACCESS_FINE_LOCATION": ("위치", 1),
    "android.permission.ACCESS_BACKGROUND_LOCATION": ("위치(항상)", 2),
    "android.permission.RECORD_AUDIO": ("마이크", 1),
    "android.permission.CAMERA": ("카메라", 1),
    "android.permission.READ_EXTERNAL_STORAGE": ("사진·파일", 1),
    "android.permission.READ_MEDIA_IMAGES": ("사진·파일", 1),
    "android.permission.READ_MEDIA_VIDEO": ("사진·파일", 1),
    "android.permission.READ_PHONE_STATE": ("전화번호·기기정보", 1),
    "android.permission.READ_PHONE_NUMBERS": ("전화번호·기기정보", 1),
    "android.permission.READ_CALENDAR": ("캘린더", 1),
    "android.permission.QUERY_ALL_PACKAGES": ("설치앱 목록", 1),
}
APPOPS = {
    "SYSTEM_ALERT_WINDOW": "다른 앱 위에 표시",
    "GET_USAGE_STATS": "사용 기록 접근",
    "REQUEST_INSTALL_PACKAGES": "앱 설치 권한",
    "MANAGE_EXTERNAL_STORAGE": "모든 파일 접근",
}
# 알려진 VPN 앱: (판별 함수, 이름, 안내). 유니콘은 안드로이드 패키지 이름을 확인하지 못해 이름으로 추정한다.
VPN_NOTES = [
    (lambda p: p == "com.tailscale.ipn", "Tailscale",
     "기기끼리 직접 암호화(WireGuard)해 잇는 방식이라, 평소에는 내 기기들(100.x 대역)과의 통신만 터널로 갑니다.\n"
     "확인할 것: (1) login.tailscale.com/admin/machines 에 모르는 기기가 없는지 "
     "(2) '종료 노드(Exit node)'를 켰다면 모든 인터넷 통신이 그 기기를 거치므로 본인 기기가 맞는지 "
     "(3) 남에게 공유한 기기·초대가 남아 있지 않은지 (4) 키 만료(Key expiry)가 켜져 있는지"),
    (lambda p: "lylstudio" in p or "unicorn" in p, "유니콘(패키지 이름으로 추정)",
     "개발사 안내로는 외부 서버를 거치지 않고 폰 안에서만 도는 로컬 VPN입니다(이 도구가 검증한 내용은 아님).\n"
     "확인할 것: (1) 아래 설치 경로가 공식 스토어인지 "
     "(2) HTTPS 필터링용 인증서를 설치했다면 사용자 인증서 목록에 유니콘 것 외에 다른 것이 없는지"),
]
DNS_NAMES = {
    "100.100.100.100": "Tailscale MagicDNS", "1.1.1.1": "Cloudflare", "1.0.0.1": "Cloudflare",
    "8.8.8.8": "Google", "8.8.4.4": "Google", "9.9.9.9": "Quad9",
    "94.140.14.14": "AdGuard DNS", "94.140.15.15": "AdGuard DNS",
    "168.126.63.1": "KT", "168.126.63.2": "KT", "210.220.163.82": "SK브로드밴드",
    "219.250.36.130": "SK브로드밴드", "164.124.101.2": "LG U+", "203.248.252.2": "LG U+",
}
ROOT_PKGS = {"com.topjohnwu.magisk", "eu.chainfire.supersu", "me.weishu.kernelsu"}
PKG_RE = re.compile(r"[A-Za-z][\w]*(\.[\w]+)+")

SEV_ORDER = {"HIGH": 0, "MED": 1, "LOW": 2, "INFO": 3}
SEV_KO = {"HIGH": "위험", "MED": "경고", "LOW": "주의", "INFO": "정보"}


def watch_label(pkg):
    p = (pkg or "").lower()
    if p in WATCH_PKG:
        return WATCH_PKG[p]
    for pre, label in WATCH_PREFIX:
        if p.startswith(pre):
            return label
    return None


def classify_domain(domain, country=""):
    """도메인을 (분류, 소유자)로. 해당 없으면 None."""
    d = (domain or "").strip().lower().rstrip(".")
    parts = d.split(".")
    for i in range(len(parts) - 1):
        hit = DOMAIN_RULES.get(".".join(parts[i:]))
        if hit:
            return hit
    country = (country or "").upper()
    if d.endswith(".cn") or country == "CN":
        return ("cn", "중국 소재/.cn")
    if d.endswith(".ru") or country == "RU":
        return ("ru", "러시아 소재/.ru")
    return None


def human(n):
    n = float(n)
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024 or unit == "GB":
            return f"{n:.0f}{unit}" if unit == "B" else f"{n:.1f}{unit}"
        n /= 1024


# --------------------------------------------------------------------------
# 보고서
# --------------------------------------------------------------------------

class Report:
    def __init__(self, title):
        self.title = title
        self.meta = []        # (이름, 값)
        self.findings = []    # dict(sev, title, detail, fix)
        self.tables = []      # dict(title, headers, rows, note)
        self.skipped = []     # 확인하지 못한 항목

    def add(self, sev, title, detail="", fix=""):
        self.findings.append({"sev": sev, "title": title, "detail": detail, "fix": fix})

    def table(self, title, headers, rows, note=""):
        if rows:
            self.tables.append({"title": title, "headers": headers,
                                "rows": [[str(c) for c in r] for r in rows], "note": note})

    def sorted_findings(self):
        return sorted(self.findings, key=lambda f: SEV_ORDER[f["sev"]])

    def counts(self):
        c = Counter(f["sev"] for f in self.findings)
        return {s: c.get(s, 0) for s in SEV_ORDER}

    def to_text(self):
        out = [f"== {self.title} ==", ""]
        out += [f"{k}: {v}" for k, v in self.meta]
        c = self.counts()
        out += ["", "요약: " + "  ".join(f"{SEV_KO[s]} {c[s]}" for s in SEV_ORDER), ""]
        for f in self.sorted_findings():
            out.append(f"[{SEV_KO[f['sev']]}] {f['title']}")
            for line in f["detail"].splitlines():
                out.append(f"      {line}")
            if f["fix"]:
                out.append(f"      -> 조치: {f['fix']}")
        if not self.findings:
            out.append("발견된 항목이 없습니다.")
        if self.skipped:
            out += ["", "확인하지 못한 항목(수동 확인 필요):"] + [f"  - {s}" for s in self.skipped]
        return "\n".join(out)

    def to_json(self):
        return json.dumps({"title": self.title, "meta": self.meta, "counts": self.counts(),
                           "findings": self.sorted_findings(), "tables": self.tables,
                           "skipped": self.skipped}, ensure_ascii=False, indent=2)

    def to_html(self):
        e = html.escape
        c = self.counts()
        parts = [HTML_HEAD.replace("{title}", e(self.title)),
                 f"<h1>{e(self.title)}</h1>", "<p class=meta>"]
        parts.append(" · ".join(f"{e(k)}: <b>{e(str(v))}</b>" for k, v in self.meta))
        parts.append("</p><div class=sum>")
        for s in SEV_ORDER:
            parts.append(f"<div class='pill {s}'><b>{c[s]}</b>{SEV_KO[s]}</div>")
        parts.append("</div><h2>발견 항목</h2>")
        if not self.findings:
            parts.append("<p>발견된 항목이 없습니다.</p>")
        for f in self.sorted_findings():
            parts.append(f"<div class='f {f['sev']}'><span class=tag>{SEV_KO[f['sev']]}</span>"
                         f"<h3>{e(f['title'])}</h3>")
            if f["detail"]:
                parts.append("<p>" + "<br>".join(e(x) for x in f["detail"].splitlines()) + "</p>")
            if f["fix"]:
                parts.append(f"<p class=fix>조치: {e(f['fix'])}</p>")
            parts.append("</div>")
        for t in self.tables:
            parts.append(f"<h2>{e(t['title'])}</h2>")
            if t["note"]:
                parts.append(f"<p class=meta>{e(t['note'])}</p>")
            parts.append("<div class=scroll><table><tr>" +
                         "".join(f"<th>{e(h)}</th>" for h in t["headers"]) + "</tr>")
            for r in t["rows"]:
                parts.append("<tr>" + "".join(f"<td>{e(x)}</td>" for x in r) + "</tr>")
            parts.append("</table></div>")
        if self.skipped:
            parts.append("<h2>확인하지 못한 항목</h2><ul>" +
                         "".join(f"<li>{e(s)}</li>" for s in self.skipped) + "</ul>")
        parts.append("<p class=meta>이 보고서에는 설치 앱 목록 등 개인 정보가 들어 있습니다. "
                     "공개된 곳에 올리지 마세요. '중국 기업' 표시는 본사 소재지에 따른 정보이며 "
                     "그 자체가 유출의 증거는 아닙니다.</p></body></html>")
        return "\n".join(parts)


HTML_HEAD = """<!doctype html><html lang=ko><head><meta charset=utf-8>
<meta name=viewport content="width=device-width,initial-scale=1"><title>{title}</title><style>
:root{--bg:#f6f7f9;--card:#fff;--fg:#1c2128;--mut:#5c6673;--line:#dfe3e8;
--HIGH:#c62828;--MED:#d9730d;--LOW:#9a7b00;--INFO:#2f6fb5}
@media(prefers-color-scheme:dark){:root{--bg:#14171c;--card:#1d2229;--fg:#e6e9ee;--mut:#9aa4b1;
--line:#2f3741;--HIGH:#ff6b6b;--MED:#ffa24d;--LOW:#e2c044;--INFO:#6aa9ea}}
body{background:var(--bg);color:var(--fg);font:15px/1.6 system-ui,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;
max-width:960px;margin:0 auto;padding:16px}
h1{font-size:22px;margin:8px 0}h2{font-size:17px;margin:28px 0 8px}h3{font-size:15px;margin:0 0 4px}
.meta{color:var(--mut);font-size:13px}.sum{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}
.pill{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:8px 14px;font-size:13px}
.pill b{font-size:20px;margin-right:6px}
.pill.HIGH b{color:var(--HIGH)}.pill.MED b{color:var(--MED)}.pill.LOW b{color:var(--LOW)}.pill.INFO b{color:var(--INFO)}
.f{background:var(--card);border:1px solid var(--line);border-left:5px solid;border-radius:8px;padding:10px 14px;margin:8px 0}
.f.HIGH{border-left-color:var(--HIGH)}.f.MED{border-left-color:var(--MED)}
.f.LOW{border-left-color:var(--LOW)}.f.INFO{border-left-color:var(--INFO)}
.f p{margin:4px 0;font-size:14px;overflow-wrap:anywhere}.tag{float:right;font-size:12px;color:var(--mut)}
.fix{color:var(--mut)}.scroll{overflow-x:auto}
table{border-collapse:collapse;width:100%;min-width:620px;background:var(--card);font-size:13px}
th,td{border:1px solid var(--line);padding:5px 8px;text-align:left;vertical-align:top}
td{overflow-wrap:anywhere}th{white-space:nowrap}
</style></head><body>"""


# --------------------------------------------------------------------------
# 안드로이드 - adb 출력 파서 (순수 함수)
# --------------------------------------------------------------------------

def parse_getprop(text):
    return dict(re.findall(r"^\[([^\]]+)\]: \[(.*)\]\s*$", text, re.M))


def parse_pm_list(text):
    """`pm list packages -i -U` -> {pkg: {installer, uid}}"""
    out = {}
    for line in text.splitlines():
        m = re.match(r"package:(\S+)", line.strip())
        if not m:
            continue
        inst = re.search(r"installer=(\S+)", line)
        uid = re.search(r"uid:(\d+)", line)
        installer = inst.group(1) if inst else None
        out[m.group(1)] = {"installer": None if installer in (None, "null") else installer,
                           "uid": int(uid.group(1)) if uid else None}
    return out


def parse_dumpsys_package(text):
    """`dumpsys package` 전체 -> {pkg: {perms, version, first_install, target_sdk}}"""
    pkgs, cur = {}, None
    for line in text.splitlines():
        if line and not line[0].isspace():
            cur = None           # 새 최상위 구역(Shared users 등)
            continue
        m = re.match(r"\s+Package \[([^\]]+)\] \(", line)
        if m:
            cur = pkgs.setdefault(m.group(1), {"perms": set(), "version": "",
                                               "first_install": "", "target_sdk": ""})
            continue
        if cur is None:
            continue
        s = line.strip()
        m = re.match(r"([\w.]+): granted=true", s)
        if m:
            cur["perms"].add(m.group(1))
        elif s.startswith("versionName=") and not cur["version"]:
            cur["version"] = s.split("=", 1)[1]
        elif s.startswith("firstInstallTime=") and not cur["first_install"]:
            cur["first_install"] = s.split("=", 1)[1]
        elif not cur["target_sdk"]:
            m = re.search(r"targetSdk=(\d+)", s)
            if m:
                cur["target_sdk"] = m.group(1)
    return pkgs


def parse_components(value):
    """settings 값 'a.b/.Svc:c.d/e.F' -> 패키지 집합"""
    out = set()
    for comp in (value or "").strip().split(":"):
        pkg = comp.split("/")[0].strip()
        if PKG_RE.fullmatch(pkg):
            out.add(pkg)
    return out


def parse_launcher(text):
    """`cmd package query-activities --brief ...` -> 런처 아이콘이 있는 패키지 집합"""
    return set(re.findall(r"^\s*([A-Za-z][\w.]*)/[\w.$]+\s*$", text, re.M))


def parse_device_policy(text):
    """-> (기기 관리자 패키지 집합, 기기/프로필 소유자 패키지 집합)"""
    admins = set(re.findall(r"^\s+([A-Za-z][\w.]*)/[\w.$]+:\s*$", text, re.M))
    owners = set()
    lines = text.splitlines()
    for i, line in enumerate(lines):
        if re.match(r"\s*(Device Owner|Profile Owner)", line):
            for nxt in lines[i:i + 6]:
                m = re.search(r"ComponentInfo\{([\w.]+)/", nxt)
                if m:
                    owners.add(m.group(1))
                    break
    return admins, owners


def parse_vpn_services(text):
    """`dumpsys package`의 서비스 표에서 VpnService를 선언한 패키지 집합"""
    out, on = set(), False
    for line in text.splitlines():
        if line.strip() == "android.net.VpnService:":
            on = True
        elif on:
            m = re.match(r"\s+[0-9a-f]+ ([A-Za-z][\w.]*)/", line)
            if not m:
                on = False
            else:
                out.add(m.group(1))
    return out


def parse_connectivity(text):
    """`dumpsys connectivity` -> 연결된 네트워크 목록 [{iface, vpn, owner, dns}]"""
    nets = {}
    for line in text.splitlines():
        iface = re.search(r"InterfaceName: (\S+)", line)
        if "NetworkAgentInfo" not in line or not iface:
            continue
        tr = re.search(r"Transports: ([A-Z_|]+)", line)
        dns = re.search(r"DnsAddresses: \[([^\]]*)\]", line)
        owner = re.search(r"OwnerUid: (\d+)", line)
        nets[iface.group(1)] = {
            "iface": iface.group(1),
            "vpn": bool(tr and "VPN" in tr.group(1).split("|")),
            "owner": int(owner.group(1)) if owner else None,
            "dns": [d.strip(" /") for d in (dns.group(1) if dns else "").split(",") if d.strip(" /")],
        }
    return list(nets.values())


def dns_label(addr):
    if addr in DNS_NAMES:
        return f"{addr} ({DNS_NAMES[addr]})"
    try:
        if ipaddress.ip_address(addr.split("%")[0]).is_private:
            return f"{addr} (공유기/내부망)"
    except ValueError:
        pass
    return addr


def vpn_note(pkg):
    for match, name, note in VPN_NOTES:
        if match(pkg.lower()):
            return name, note
    return None, ""


def parse_netstats(text):
    """`dumpsys netstats detail` -> {uid: {rx, tx, bg_tx}} (UID stats 구역만)"""
    usage = defaultdict(lambda: {"rx": 0, "tx": 0, "bg_tx": 0})
    in_uid, uid, bg = False, None, False
    for line in text.splitlines():
        s = line.strip()
        if line and not line[0].isspace():
            in_uid = s == "UID stats:"
            uid = None
            continue
        if not in_uid:
            continue
        m = re.search(r"\buid=(-?\d+)\b.*\bset=(\w+)\b.*\btag=(\w+)", s)
        if m:
            uid = int(m.group(1)) if m.group(3) == "0x0" else None
            bg = m.group(2) == "DEFAULT"
            continue
        if uid is not None:
            rb, tb = re.search(r"\brb=(\d+)", s), re.search(r"\btb=(\d+)", s)
            if rb and tb:
                usage[uid]["rx"] += int(rb.group(1))
                usage[uid]["tx"] += int(tb.group(1))
                if bg:
                    usage[uid]["bg_tx"] += int(tb.group(1))
    return dict(usage)


def load_ioc(path):
    """스토커웨어 IOC 불러오기. 패키지명만 줄마다 적은 txt, 또는
    AssoEchap/stalkerware-indicators 의 ioc.yaml 형식(name:/packages: 목록)."""
    pkgs, name, in_pk = {}, None, False
    with open(path, encoding="utf-8", errors="replace") as fh:
        for line in fh:
            s = line.strip()
            if not s or s.startswith("#"):
                continue
            m = re.match(r"(?:-\s*)?name:\s*(.+)", s)
            if m:
                name, in_pk = m.group(1).strip("'\" "), False
                continue
            if re.match(r"packages:\s*$", s):
                in_pk = True
                continue
            if in_pk:
                m = re.match(r"-\s*['\"]?([A-Za-z][\w]*(?:\.[\w]+)+)['\"]?\s*$", s)
                if m:
                    pkgs[m.group(1)] = name or "스토커웨어"
                    continue
                in_pk = False
            if PKG_RE.fullmatch(s):
                pkgs[s] = "IOC 목록"
    return pkgs


# --------------------------------------------------------------------------
# 안드로이드 점검
# --------------------------------------------------------------------------

class Adb:
    def __init__(self, serial=None, exe="adb"):
        self.base = [exe] + (["-s", serial] if serial else [])

    def run(self, args, timeout=60):
        try:
            r = subprocess.run(self.base + args, capture_output=True, text=True,
                               errors="replace", timeout=timeout)
            return r.stdout
        except subprocess.TimeoutExpired:
            return ""

    def shell(self, cmd, timeout=60):
        return self.run(["shell", cmd], timeout)

    def state(self):
        """'device' / 'unauthorized' / 'missing'(adb 없음) / 'none'"""
        try:
            r = subprocess.run(self.base + ["get-state"], capture_output=True, text=True, timeout=20)
        except FileNotFoundError:
            return "missing"
        except subprocess.TimeoutExpired:
            return "none"
        if "unauthorized" in r.stderr:
            return "unauthorized"
        return r.stdout.strip() or "none"


def android_audit(adb, ioc=None, today=None):
    ioc = ioc or {}
    today = today or dt.date.today()
    rep = Report("안드로이드 점검 결과")

    def setting(ns, key):
        v = adb.shell(f"settings get {ns} {key}").strip()
        return "" if v in ("null", "") else v

    # ---- 기기 상태 ----
    props = parse_getprop(adb.shell("getprop"))
    g = props.get
    rep.meta += [("기기", f"{g('ro.product.manufacturer', '?')} {g('ro.product.model', '?')}"),
                 ("Android", g("ro.build.version.release", "?")),
                 ("보안 패치", g("ro.build.version.security_patch", "?")),
                 ("점검 시각", dt.datetime.now().strftime("%Y-%m-%d %H:%M"))]
    patch = g("ro.build.version.security_patch", "")
    try:
        months = (today - dt.date.fromisoformat(patch)).days // 30
        if months >= 12:
            rep.add("HIGH" if months >= 24 else "MED", f"보안 패치가 약 {months}개월 전 것입니다 ({patch})",
                    "알려진 취약점이 막히지 않은 상태라 악성 앱·웹페이지 공격에 약합니다.",
                    "설정 > 소프트웨어 업데이트. 더 이상 업데이트가 안 나오면 기기 교체를 고려하세요.")
    except ValueError:
        rep.skipped.append("보안 패치 날짜를 읽지 못했습니다.")
    vb = g("ro.boot.verifiedbootstate", "")
    if vb and vb != "green" or g("ro.boot.flash.locked") == "0":
        rep.add("MED", f"부트로더 잠금 해제 / 검증 부팅 상태 이상 (verifiedbootstate={vb or '?'})",
                "시스템이 변조돼도 부팅 시 걸러지지 않습니다. 직접 커스텀 롬을 설치한 게 아니라면 위험 신호입니다.",
                "본인이 한 일이 아니라면 공식 펌웨어로 초기화하세요.")
    if g("ro.debuggable") == "1" or "test-keys" in g("ro.build.tags", ""):
        rep.add("MED", "비공식(디버그/test-keys) 시스템 빌드", "제조사 정식 빌드가 아닙니다.",
                "의도한 커스텀 롬이 아니면 공식 펌웨어로 복구하세요.")
    if g("ro.crypto.state") == "unencrypted":
        rep.add("HIGH", "저장소 암호화가 꺼져 있습니다", "분실 시 데이터가 그대로 읽힙니다.",
                "설정 > 보안에서 암호화를 켜고 화면 잠금을 설정하세요.")
    su = adb.shell("which su; ls /system/xbin/su /system/bin/su /sbin/su 2>/dev/null").strip()
    if "/su" in su:
        rep.add("MED", "루팅 흔적(su 바이너리) 발견", su.replace("\n", ", "),
                "직접 루팅한 게 아니라면 공식 펌웨어로 초기화하세요.")
    if adb.shell("settings get global package_verifier_user_consent").strip() == "-1":
        rep.add("MED", "Play 프로텍트 검사가 꺼져 있습니다", "악성 앱 자동 검사가 동작하지 않습니다.",
                "Play 스토어 > 프로필 > Play 프로텍트 > 설정에서 켜세요.")

    # ---- 네트워크 가로채기 설정 ----
    proxy = setting("global", "http_proxy")
    if proxy and proxy != ":0":
        rep.add("HIGH", f"전역 프록시가 설정되어 있습니다: {proxy}",
                "모든 웹 트래픽이 이 서버를 거쳐 갑니다. 본인/회사가 설정한 게 아니면 감청 가능성이 있습니다.",
                "설정 > Wi-Fi > 해당 네트워크 > 프록시 '없음'. (adb shell settings put global http_proxy :0)")
    if setting("global", "private_dns_mode") == "hostname":
        rep.add("INFO", "프라이빗 DNS 사용 중: " + setting("global", "private_dns_specifier"),
                "모든 도메인 조회가 이 서버로 갑니다. 본인이 설정한 것(NextDNS, AdGuard 등)인지 확인하세요.")
    always_on = setting("secure", "always_on_vpn_app")
    lockdown = setting("secure", "always_on_vpn_lockdown") == "1"
    certs = adb.shell("ls /data/misc/user/0/cacerts-added 2>&1").strip()
    if "denied" in certs.lower():
        rep.skipped.append("사용자 설치 인증서: 설정 > 보안 > 암호화 및 사용자 인증 정보 > "
                           "사용자 인증서에 본인이 모르는 인증서가 있는지 직접 확인하세요.")
    elif certs and "No such" not in certs:
        rep.add("HIGH", f"사용자가 설치한 루트 인증서 {len(certs.split())}개 발견",
                "이 인증서의 주인은 암호화(HTTPS) 통신 내용을 풀어볼 수 있습니다. 회사/학교 인증서가 아니면 위험합니다.",
                "설정 > 보안 > 사용자 인증서에서 모르는 인증서를 삭제하세요.")

    # ---- 앱 목록 ----
    all_pkgs = parse_pm_list(adb.shell("pm list packages -i -U", 120))
    third = set(parse_pm_list(adb.shell("pm list packages -3", 120)))
    if not all_pkgs:
        rep.add("INFO", "앱 목록을 가져오지 못했습니다", "adb 연결 상태를 확인하세요.")
        return rep
    dump = adb.shell("dumpsys package", 300)
    details = parse_dumpsys_package(dump)
    uid2pkg = defaultdict(list)
    for pkg, v in all_pkgs.items():
        if v["uid"] is not None:
            uid2pkg[v["uid"]].append(pkg)

    def source(pkg):
        """-> (비공식 설치 여부, 설치 경로 설명)"""
        inst = all_pkgs.get(pkg, {}).get("installer")
        return (inst not in TRUSTED_INSTALLERS,
                TRUSTED_INSTALLERS.get(inst) or f"비공식({inst or '설치경로 없음'})")
    a11y = parse_components(setting("secure", "enabled_accessibility_services"))
    notif = parse_components(setting("secure", "enabled_notification_listeners"))
    admins, owners = parse_device_policy(adb.shell("dumpsys device_policy"))
    launcher = parse_launcher(adb.shell(
        "cmd package query-activities --brief -a android.intent.action.MAIN "
        "-c android.intent.category.LAUNCHER", 120))
    if len(launcher) < 5:
        launcher = None
        rep.skipped.append("아이콘을 숨긴 앱 탐지(런처 목록 조회 실패)")
    appops = {}
    for op, label in APPOPS.items():
        for pkg in re.findall(r"^[A-Za-z]\w*(?:\.\w+)+$", adb.shell(f"appops query-op {op} allow"), re.M):
            appops.setdefault(pkg, []).append(label)
    rep.meta.append(("앱 수", f"전체 {len(all_pkgs)} / 사용자 설치 {len(third)}"))

    for owner in owners:
        sev = "HIGH" if owner in third else "INFO"
        rep.add(sev, f"기기 소유자(MDM)로 등록된 앱: {owner}",
                "기기 전체를 원격 제어·감시할 수 있는 최고 권한입니다. 회사/학교 지급폰이 아니면 비정상입니다.",
                "회사 폰이 아니면 공장 초기화가 가장 확실합니다.")
    for pkg in sorted(ROOT_PKGS & set(all_pkgs)):
        rep.add("MED", f"루팅 관리 앱 설치됨: {pkg}", "", "직접 설치한 게 아니면 초기화를 고려하세요.")

    # ---- VPN / DNS ----
    vpn_apps = set(re.findall(r"^[A-Za-z]\w*(?:\.\w+)+$",
                              adb.shell("appops query-op ACTIVATE_VPN allow"), re.M))
    vpn_apps = ((vpn_apps or parse_vpn_services(dump)) | {always_on}) & third
    nets = parse_connectivity(adb.shell("dumpsys connectivity", 120))
    active = {p for n in nets if n["vpn"] for p in uid2pkg.get(n["owner"], [])}
    for pkg in sorted(vpn_apps):
        side, src = source(pkg)
        name, note = vpn_note(pkg)
        state = (["지금 켜져 있음"] if pkg in active else []) + \
                (["항상 켜짐" + (" + VPN 없이는 연결 차단" if lockdown else "")] if pkg == always_on else [])
        title = f"VPN 앱: {pkg}" + (f" ({name})" if name else "") + \
                (" - " + ", ".join(state) if state else "")
        if side:
            rep.add("HIGH" if launcher is not None and pkg not in launcher else "MED", title,
                    "공식 스토어 밖에서 설치된 VPN 앱입니다. VPN 앱은 폰의 모든 통신이 지나가는 자리라, "
                    f"변조된 가짜 앱이면 그대로 감청 도구가 됩니다.\n설치 경로: {src}",
                    "직접 받은 APK가 아니면 삭제하고 공식 스토어에서 다시 설치하세요.")
        elif name:
            rep.add("INFO", title, f"{note}\n설치 경로: {src}")
        else:
            rep.add("LOW", title, "VPN 앱은 폰의 모든 통신이 지나가는 자리입니다. 무료 VPN 중에는 "
                    f"트래픽을 수집·판매하는 곳이 많습니다.\n설치 경로: {src}",
                    "운영 주체를 믿을 수 있는 앱이 아니면 삭제하세요.")
    if any(n["vpn"] for n in nets) and not active & vpn_apps:
        rep.add("LOW", "VPN이 켜져 있는데 어느 앱 것인지 확인하지 못했습니다",
                "소유 앱: " + (", ".join(sorted(active)) or "미확인"),
                "설정 > 연결 > 기타 연결 설정 > VPN에서 어떤 앱인지 확인하세요.")
    dns_lines = [f"{n['iface']}{'(VPN)' if n['vpn'] else ''}: " + ", ".join(dns_label(d) for d in n["dns"])
                 for n in nets if n["dns"]]
    if dns_lines:
        rep.add("INFO", "지금 쓰고 있는 DNS 서버", "\n".join(dns_lines) +
                "\nDNS 서버는 내가 접속하는 모든 사이트 이름을 봅니다. 이름이 안 붙은 주소는 보통 통신사 것이지만, "
                "집 Wi-Fi에서 낯선 주소가 보이면 공유기 설정이 바뀌지 않았는지 확인하세요.")

    rows, sideloaded, watched = [], [], []
    for pkg in sorted(third):
        info = details.get(pkg, {"perms": set(), "version": "", "first_install": ""})
        side, src = source(pkg)
        groups = {}
        for p in info["perms"]:
            if p in SENSITIVE_PERMS:
                label, w = SENSITIVE_PERMS[p]
                groups[label] = max(groups.get(label, 0), w)
        special = []
        hidden = launcher is not None and pkg not in launcher
        if pkg in a11y:
            special.append("접근성")
        if pkg in notif:
            special.append("알림 읽기")
        if pkg in admins:
            special.append("기기 관리자")
        special += appops.get(pkg, [])
        if hidden:
            special.append("아이콘 없음")
        score = (sum(groups.values()) + (2 if side else 0) + (3 if pkg in a11y else 0) +
                 (2 if pkg in notif else 0) + (2 if pkg in admins else 0) +
                 len(appops.get(pkg, [])) + (2 if hidden and groups else 0))
        perms_txt = ", ".join(sorted(groups)) or "-"
        wl = watch_label(pkg)

        if pkg in ioc:
            rep.add("HIGH", f"알려진 스토커웨어와 일치: {pkg} ({ioc[pkg]})",
                    "스토커웨어 IOC 목록에 있는 패키지입니다.",
                    "증거가 필요하면 먼저 화면을 캡처해 두고, 삭제 후 구글 계정 비밀번호를 바꾸세요.")
        if pkg in a11y and (side or hidden):
            rep.add("HIGH", f"비공식 설치/숨김 앱이 접근성 권한 보유: {pkg}",
                    f"설치 경로: {src} / 설치일: {info['first_install'] or '?'}\n"
                    "접근성 권한은 화면 내용 읽기·입력 가로채기·대신 터치가 가능해 스파이앱·금융 악성앱이 가장 먼저 노립니다.",
                    "모르는 앱이면 설정 > 접근성에서 끄고 삭제하세요.")
        elif pkg in a11y:
            rep.add("MED", f"접근성 권한을 가진 앱: {pkg}",
                    "화면에 보이는 모든 내용과 입력을 읽을 수 있습니다.", "꼭 필요한 앱인지 확인하세요.")
        if pkg in notif:
            rep.add("MED" if side else "LOW", f"알림 내용을 읽는 앱: {pkg}",
                    "문자 인증번호, 메신저 미리보기 등 모든 알림을 읽을 수 있습니다.",
                    "설정 > 알림 > 기기 및 앱 알림(알림 접근)에서 확인하세요.")
        if pkg in admins:
            rep.add("MED", f"기기 관리자 권한을 가진 앱: {pkg}",
                    "삭제를 막거나 화면 잠금·초기화를 제어할 수 있습니다.",
                    "설정 > 보안 > 기기 관리자 앱에서 해제 후 삭제할 수 있습니다.")
        if hidden and pkg not in a11y and sum(groups.values()) >= 2:
            rep.add("MED", f"아이콘이 없는 앱이 민감 권한 보유: {pkg}",
                    f"권한: {perms_txt} / 설치 경로: {src}\n앱 서랍에 보이지 않는 앱입니다.",
                    "설정 > 애플리케이션에서 직접 찾아 용도를 확인하세요.")
        if side and "문자" in groups and pkg not in a11y:
            rep.add("MED", f"비공식 설치 앱이 문자(SMS) 권한 보유: {pkg}",
                    f"설치 경로: {src}\n인증번호 탈취형 악성앱(스미싱)의 전형적인 형태입니다.",
                    "직접 설치한 앱이 아니면 삭제하세요.")
        if side:
            sideloaded.append(f"{pkg} [{src}]")
        if wl:
            watched.append(f"{pkg} - {wl} / 권한: {perms_txt}")
        if score or wl:
            rows.append((score, [pkg + (f" ({wl})" if wl else ""), src, perms_txt,
                                 ", ".join(special) or "-", score]))

    if sideloaded:
        rep.add("LOW", f"스토어를 거치지 않고 설치된 앱 {len(sideloaded)}개",
                "\n".join(sideloaded[:40]), "직접 설치한 기억이 없는 앱은 삭제하세요.")
    if watched:
        rep.add("LOW", f"중국 본사 기업의 앱 {len(watched)}개 (사용자 설치)", "\n".join(watched[:40]),
                "쓰지 않는 앱은 삭제하고, 쓰는 앱은 위치·연락처·사진·마이크 권한을 '허용 안 함' 또는 "
                "'사용 중에만'으로 줄이세요.")
    sys_watch = sorted(p for p in all_pkgs if p not in third and watch_label(p))
    if sys_watch:
        rep.add("INFO", f"기본 탑재(시스템) 앱 중 중국 기업 앱 {len(sys_watch)}개",
                ", ".join(sys_watch[:30]) + (" ..." if len(sys_watch) > 30 else "") +
                "\n해당 제조사 휴대폰이면 정상적으로 들어 있는 앱입니다.")

    # ---- 키보드 ----
    ime = setting("secure", "default_input_method").split("/")[0]
    if ime and ime in third:
        wl = watch_label(ime)
        rep.add("MED" if wl or all_pkgs[ime]["installer"] not in TRUSTED_INSTALLERS else "LOW",
                f"서드파티 키보드 사용 중: {ime}" + (f" ({wl})" if wl else ""),
                "키보드 앱은 비밀번호를 포함해 입력하는 모든 글자를 볼 수 있습니다.",
                "신뢰하기 어렵다면 기본 키보드(삼성 키보드/Gboard)로 바꾸세요.")

    rows.sort(key=lambda r: -r[0])
    rep.table("사용자 설치 앱 위험도 순", ["앱", "설치 경로", "민감 권한", "특수 접근", "점수"],
              [r[1] for r in rows[:50]],
              "점수는 권한 조합으로 계산한 '살펴볼 우선순위'이지 악성 판정이 아닙니다.")

    # ---- 데이터 사용량: 실제로 얼마나 내보냈나 ----
    usage = parse_netstats(adb.shell("dumpsys netstats detail", 120))
    net_rows, heavy = [], []
    for uid, u in sorted(usage.items(), key=lambda kv: -kv[1]["tx"]):
        if uid < 10000 or u["tx"] == 0:
            continue
        names = uid2pkg.get(uid, [f"uid {uid}"])
        name = names[0] + (f" 외 {len(names) - 1}" if len(names) > 1 else "")
        wl = watch_label(names[0])
        is_vpn = bool(vpn_apps & set(names))
        net_rows.append([name + (f" ({wl})" if wl else "") + (" [VPN]" if is_vpn else ""),
                         human(u["tx"]), human(u["bg_tx"]),
                         human(u["rx"])])
        if names[0] in third and not is_vpn and u["tx"] > u["rx"] and u["tx"] > 100 * 1024 * 1024:
            heavy.append(f"{name}: 보냄 {human(u['tx'])} / 받음 {human(u['rx'])}")
    if heavy:
        rep.add("LOW", "받은 것보다 보낸 데이터가 많은 앱", "\n".join(heavy[:15]),
                "클라우드 백업·영상 업로드 앱이면 정상입니다. 그 외 앱이면 무엇을 올리는지 의심해 보세요.")
    if usage:
        rep.table("앱별 데이터 전송량 (보낸 양 순)", ["앱", "보냄", "백그라운드 보냄", "받음"],
                  net_rows[:25], "기기에 남아 있는 통계 기간(보통 최근 몇 주) 기준입니다. "
                  "[VPN] 표시 앱은 다른 앱의 통신을 실어 나르므로 전송량이 크게 잡힐 수 있습니다.")
    else:
        rep.skipped.append("앱별 데이터 전송량(netstats 조회 실패). 설정 > 연결 > 데이터 사용에서 확인하세요.")
    rep.skipped.append("통신 '내용'과 접속 '목적지'는 adb로 볼 수 없습니다. "
                       "PCAPdroid로 기록한 뒤 `phone_audit.py netlog`로 분석하세요.")
    if vpn_apps:
        rep.skipped.append("안드로이드는 VPN을 한 번에 하나만 켤 수 있습니다. PCAPdroid도 VPN 자리를 쓰므로 "
                           "기록하는 동안에는 Tailscale·유니콘 등 다른 VPN이 꺼집니다. VPN을 켠 상태의 통신은 "
                           "이 방법으로 기록할 수 없습니다.")
    return rep


# --------------------------------------------------------------------------
# 통신 기록 공통 분석 (iOS 리포트 / PCAPdroid / NextDNS)
# --------------------------------------------------------------------------

def summarize_flows(rep, flows, has_bytes=False):
    """flows: (앱, 도메인, 횟수, 보낸 바이트, 국가) 목록"""
    apps = defaultdict(lambda: {"domains": set(), "cn": Counter(), "ru": Counter(),
                                "tracker": Counter(), "sent": 0, "flag_sent": 0})
    doms = defaultdict(lambda: {"hits": 0, "apps": set(), "cls": None})
    for app, domain, hits, sent, country in flows:
        app = app or "(앱 미확인)"
        a = apps[app]
        a["domains"].add(domain)
        a["sent"] += sent
        cls = classify_domain(domain, country)
        if cls:
            a[cls[0]][domain] += hits
            if cls[0] in ("cn", "ru"):
                a["flag_sent"] += sent
            d = doms[domain]
            d["hits"] += hits
            d["apps"].add(app)
            d["cls"] = cls

    for app, a in sorted(apps.items()):
        for cat in ("cn", "ru"):
            if not a[cat]:
                continue
            own = watch_label(app) if cat == "cn" else None
            top = ", ".join(f"{d}({classify_domain(d, 'CN' if cat == 'cn' else 'RU')[1]}, {n}회)"
                            for d, n in a[cat].most_common(8))
            sev = "INFO" if own else ("MED" if a["flag_sent"] > 10 * 1024 * 1024 else "LOW")
            detail = top + (f"\n해당 도메인으로 보낸 양: {human(a['flag_sent'])}" if has_bytes else "")
            if own:
                detail += f"\n{own} 앱이므로 자사 서버와의 통신은 예상된 동작입니다."
            rep.add(sev, f"{app}: {CAT_KO[cat]} 기업/소재 도메인 {len(a[cat])}곳과 통신", detail,
                    "" if own else "앱에 꼭 필요한 통신인지 확인하고, 불필요한 앱은 삭제하거나 권한을 줄이세요. "
                    "DNS 차단(NextDNS, AdGuard DNS)으로 막을 수도 있습니다.")
    n_tr = sum(1 for a in apps.values() if a["tracker"])
    if n_tr:
        rep.add("INFO", f"광고·추적 서버와 통신한 앱 {n_tr}개", "아래 표에서 앱별 개수를 확인하세요.",
                "설정에서 광고 ID 삭제/추적 허용 끄기, DNS 기반 차단을 권장합니다.")

    rows = sorted(apps.items(), key=lambda kv: (-len(kv[1]["cn"]), -len(kv[1]["ru"]),
                                                -len(kv[1]["tracker"]), -len(kv[1]["domains"])))
    headers = ["앱", "전체 도메인", "중국", "러시아", "광고·추적"] + (["보낸 양"] if has_bytes else [])
    rep.table("앱별 통신 요약", headers,
              [[app, len(a["domains"]), len(a["cn"]), len(a["ru"]), len(a["tracker"])] +
               ([human(a["sent"])] if has_bytes else []) for app, a in rows[:60]])
    rep.table("주의 도메인 (접속 횟수 순)", ["도메인", "분류", "소유", "접속한 앱", "횟수"],
              [[d, CAT_KO[v["cls"][0]], v["cls"][1], ", ".join(sorted(v["apps"])[:5]), v["hits"]]
               for d, v in sorted(doms.items(), key=lambda kv: -kv[1]["hits"])[:80]])
    rep.meta.append(("앱 / 도메인 수", f"{len(apps)} / {len({f[1] for f in flows})}"))
    if not flows:
        rep.add("INFO", "통신 기록이 비어 있습니다", "파일 형식을 확인하세요.")


IOS_CAT_KO = {"location": "위치", "contacts": "연락처", "camera": "카메라", "microphone": "마이크",
              "photos": "사진", "mediaLibrary": "미디어", "screenRecording": "화면 기록"}


def ios_report(path):
    """iOS '앱 개인정보 보호 리포트' NDJSON 분석"""
    rep = Report("아이폰 앱 개인정보 보호 리포트 분석")
    flows, access, stamps, bad = [], defaultdict(Counter), [], 0
    with open(path, encoding="utf-8", errors="replace") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                o = json.loads(line)
            except ValueError:
                bad += 1
                continue
            if o.get("timeStamp"):
                stamps.append(str(o["timeStamp"])[:10])
            if o.get("type") == "networkActivity" and o.get("domain"):
                flows.append((o.get("bundleID", ""), o["domain"], int(o.get("hits", 1) or 1), 0, ""))
            elif o.get("type") == "access" and o.get("kind") != "intervalEnd":
                app = (o.get("accessor") or {}).get("identifier", "?")
                access[app][o.get("category", "?")] += 1
    rep.meta.append(("파일", os.path.basename(path)))
    if stamps:
        rep.meta.append(("기간", f"{min(stamps)} ~ {max(stamps)}"))
    if bad:
        rep.skipped.append(f"읽지 못한 줄 {bad}개")
    summarize_flows(rep, flows)
    cats = sorted({c for v in access.values() for c in v})
    rep.table("민감 데이터 접근 횟수", ["앱"] + [IOS_CAT_KO.get(c, c) for c in cats] + ["합계"],
              [[app] + [v.get(c, 0) or "-" for c in cats] + [sum(v.values())]
               for app, v in sorted(access.items(), key=lambda kv: -sum(kv[1].values()))[:50]],
              "앱을 쓰지 않을 때도 위치·마이크 접근이 많다면 설정 > 개인정보 보호에서 권한을 줄이세요.")
    for app, v in sorted(access.items()):
        wl = watch_label(app)
        if wl:
            rep.add("LOW", f"{app} ({wl}): 민감 데이터 접근 {sum(v.values())}회",
                    ", ".join(f"{IOS_CAT_KO.get(c, c)} {n}회" for c, n in v.most_common()),
                    "설정 > 개인정보 보호 및 보안에서 이 앱의 권한을 줄이세요.")
    return rep


def _pick(fields, *names):
    low = {f.lower().replace("_", "").replace(" ", ""): f for f in fields if f}
    for n in names:
        if n in low:
            return low[n]
    return None


def netlog_report(path):
    """PCAPdroid CSV / NextDNS 로그 CSV / 줄마다 도메인 하나인 텍스트 분석"""
    rep = Report("통신 기록 분석")
    rep.meta.append(("파일", os.path.basename(path)))
    with open(path, encoding="utf-8-sig", errors="replace", newline="") as fh:
        text = fh.read()
    first = text.split("\n", 1)[0]
    flows, has_bytes, no_host = [], False, 0
    if "," in first and re.search(r"domain|info|host|query", first, re.I):
        reader = csv.DictReader(text.splitlines())
        f = reader.fieldnames or []
        c_dom = _pick(f, "domain", "info", "host", "hostname", "sni", "query")
        c_app = _pick(f, "app", "clientname", "devicename", "package", "bundleid")
        c_sent = _pick(f, "bytessent", "sent")
        c_cty = _pick(f, "destinationcountry", "country")
        has_bytes = c_sent is not None
        agg = defaultdict(lambda: [0, 0, ""])
        for row in reader:
            dom = (row.get(c_dom) or "").strip().lower()
            if not PKG_RE.fullmatch(dom) or re.fullmatch(r"[\d.]+", dom):
                no_host += 1
                continue
            a = agg[((row.get(c_app) or "").strip() if c_app else "", dom)]
            a[0] += 1
            try:
                a[1] += int(row.get(c_sent) or 0) if c_sent else 0
            except ValueError:
                pass
            a[2] = (row.get(c_cty) or "") if c_cty else ""
        flows = [(app, dom, v[0], v[1], v[2]) for (app, dom), v in agg.items()]
    else:
        cnt = Counter()
        for line in text.splitlines():
            for tok in line.split("#")[0].split():
                if PKG_RE.fullmatch(tok) and not re.fullmatch(r"[\d.]+", tok):
                    cnt[tok.lower()] += 1
        flows = [("", d, n, 0, "") for d, n in cnt.items()]
    if no_host:
        rep.skipped.append(f"도메인 이름이 없는 연결 {no_host}건(IP 직접 접속 등)은 분류하지 못했습니다.")
    summarize_flows(rep, flows, has_bytes)
    return rep


# --------------------------------------------------------------------------
# 수동 점검표
# --------------------------------------------------------------------------

CHECKLIST = """\
== 도구로는 볼 수 없어서 직접 확인해야 하는 것 ==

[공통]
 1. 계정에 로그인된 기기 목록: 구글(myaccount.google.com > 보안 > 내 기기) / Apple(설정 > 내 이름)
    - 모르는 기기가 있으면 로그아웃시키고 비밀번호 변경 + 2단계 인증.
 2. 내 정보가 이미 유출됐는지: '털린 내 정보 찾기'(kidc.eprivacy.go.kr), haveibeenpwned.com
 3. 내 명의로 개통된 회선: 엠세이퍼(msafer.or.kr) 가입사실현황조회 + 가입제한 서비스.
 4. 통신사 소액결제 차단/한도 0원, USIM 비밀번호(SIM PIN) 설정.
 5. 메신저 연결 기기: 카카오톡 PC 로그인 기기, 텔레그램 '활성 세션', WhatsApp '연결된 기기'.
 6. 문자·카톡으로 받은 링크의 APK 설치, '원격 지원 앱' 설치 요구는 전부 사기로 보면 됩니다.

[안드로이드]
 7. 설정 > 보안 및 개인정보 보호 > 기타 보안 설정 > 사용자 인증서: 모르는 인증서 삭제.
 8. 설정 > 접근성 > 설치된 앱 / 설정 > 알림 > 알림 접근 / 기기 관리자 앱: 모르는 앱 해제.
 9. Play 스토어 > 프로필 > Play 프로텍트: 검사 켜기.
10. 설정 > 구글 > 광고 > 광고 ID 삭제.
11. 실제 접속 목적지 확인: PCAPdroid(F-Droid/Play, 루팅 불필요)로 하루 기록 > CSV 내보내기
    > python3 phone_audit.py netlog 파일.csv

[VPN을 쓰는 경우]
 V1. 안드로이드는 VPN을 한 번에 하나만 켭니다. Tailscale을 켜면 유니콘이 꺼지고, PCAPdroid 기록 중엔 둘 다 꺼집니다.
     "켜 놨다고 생각한 차단 앱이 사실은 꺼져 있는" 상황이 생기니 상단 열쇠 아이콘을 누가 쓰는지 확인하세요.
 V2. Tailscale: login.tailscale.com/admin/machines 에서 모르는 기기 삭제, 종료 노드(Exit node)는 본인 기기만,
     공유(Share)·사용자 초대 정리, 키 만료(Key expiry) 켜 두기.
 V3. 광고 차단·우회용 VPN 앱: 공식 스토어에서 받은 것인지, 인증서 설치를 요구했다면 그 인증서 하나만 있는지 확인.
 V4. 설정 > 연결 > 기타 연결 설정 > VPN 에 내가 모르는 VPN 항목이 없는지 확인.

[아이폰]
12. 설정 > 일반 > VPN 및 기기 관리: 모르는 '구성 프로파일'/MDM 삭제 (가장 중요).
13. 설정 > 개인정보 보호 및 보안 > 안전 점검: 공유 중인 사람·앱 일괄 검토.
14. 설정 > 개인정보 보호 및 보안 > 앱 개인정보 보호 리포트 켜기 > 7일 뒤 '앱 활동 저장'
    > python3 phone_audit.py ios 파일.ndjson
15. 설정 > 개인정보 보호 및 보안 > 추적: '앱이 추적을 요청하도록 허용' 끄기.
16. 국가급 스파이웨어(Pegasus 등)가 걱정되면: Amnesty의 MVT(mvt.re)로 백업 검사, 잠금 모드 사용.
"""


# --------------------------------------------------------------------------
# 실행
# --------------------------------------------------------------------------

def write_report(rep, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    for name, body in (("report.html", rep.to_html()), ("report.json", rep.to_json())):
        with open(os.path.join(out_dir, name), "w", encoding="utf-8") as fh:
            fh.write(body)
    print(rep.to_text())
    print(f"\n자세한 표가 들어 있는 보고서: {os.path.join(os.path.abspath(out_dir), 'report.html')}")


def main(argv=None):
    ap = argparse.ArgumentParser(description="휴대폰 정보 유출 점검 도구 (로컬 전용, 아무것도 전송하지 않음)")
    ap.add_argument("--version", action="version", version=VERSION)
    sub = ap.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("android", help="adb로 연결된 안드로이드 기기 점검")
    a.add_argument("--serial", help="기기가 여러 대일 때 adb 시리얼")
    a.add_argument("--adb", default="adb", help="adb 실행 파일 경로")
    a.add_argument("--ioc", help="스토커웨어 패키지 목록(txt 또는 ioc.yaml)")
    i = sub.add_parser("ios", help="아이폰 앱 개인정보 보호 리포트(.ndjson) 분석")
    i.add_argument("file")
    n = sub.add_parser("netlog", help="PCAPdroid/NextDNS CSV 또는 도메인 목록 분석")
    n.add_argument("file")
    sub.add_parser("checklist", help="수동 점검표 출력")
    for p in (a, i, n):
        p.add_argument("--out", default="phone-audit-report", help="보고서 저장 폴더")
    args = ap.parse_args(argv)

    if args.cmd == "checklist":
        print(CHECKLIST)
        return 0
    if args.cmd == "android":
        adb = Adb(args.serial, args.adb)
        state = adb.state()
        if state != "device":
            print({"missing": "adb를 찾을 수 없습니다. Android platform-tools를 설치하세요 (README 참고).",
                   "unauthorized": "휴대폰 화면에 뜬 'USB 디버깅을 허용하시겠습니까?'에서 허용을 누르세요."}
                  .get(state, "연결된 기기가 없습니다. USB 디버깅을 켜고 케이블을 연결하세요 (README 참고)."),
                  file=sys.stderr)
            return 2
        print("점검 중입니다. 앱이 많으면 1~2분 걸립니다...", file=sys.stderr)
        rep = android_audit(adb, load_ioc(args.ioc) if args.ioc else None)
    elif args.cmd == "ios":
        rep = ios_report(args.file)
    else:
        rep = netlog_report(args.file)
    write_report(rep, args.out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
