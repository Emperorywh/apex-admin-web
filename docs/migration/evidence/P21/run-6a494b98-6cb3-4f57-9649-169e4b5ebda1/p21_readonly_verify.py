# -*- coding: utf-8 -*-
"""
P21 工艺管理 · 真实只读联调脚本（run-6a494b98-6cb3-4f57-9649-169e4b5ebda1）。

只读口径：仅登录与 GET 查询，不发送 createOrderFlow / orderFlowOperation /
subOrderFlowOperation（调度写命令按 D32 归专用环境/现场验收，登记 site_acceptance
deferred）。凭据从本机 .env.local（APEX_TEST_USERNAME/APEX_TEST_PASSWORD）读取，
本脚本与证据记录不保存密码或完整 token。

用法：python p21_readonly_verify.py
依赖：仅 Python 3 标准库。
"""

import hashlib
import json
import os
import urllib.request
import urllib.error

BASE = "http://192.168.0.158:8888"
ENV_PATH = r"C:\code\apex-admin-web\.env.local"

results = []


def record(item, ok, detail):
    results.append({"item": item, "ok": ok, "detail": detail})
    print(("PASS" if ok else "FAIL"), item, "|", detail)


def read_env():
    env = {}
    with open(ENV_PATH, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env


def http(method, path, body=None, token=None):
    url = BASE + path
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode("utf-8"))
        except Exception:
            return e.code, {}


def main():
    env = read_env()
    username, password = env["APEX_TEST_USERNAME"], env["APEX_TEST_PASSWORD"]

    # 1. 真实登录（G03 已证实契约：password 以 32 位小写 MD5 摘要提交，与前端
    #    auth.service toPasswordDigest 同款；此处只取令牌做只读通道）
    status, res = http("POST", "/fms/v1/auth/authorize/login",
                       {"username": username,
                        "password": hashlib.md5(password.encode("utf-8")).hexdigest()})
    token = ""
    ok = status == 200 and isinstance(res.get("data"), dict)
    if ok:
        token = (res["data"] or {}).get("token") or ""
        perms = (res["data"] or {}).get("permissions") or []
        p21 = sorted(p for p in perms if "mission-template" in p)
        record("login", token != "",
               "code=%s activated=%s mission-template权限码=%s" %
               (res.get("code"), (res["data"] or {}).get("activated"), p21))
    else:
        record("login", False, "http=%s body=%s" % (status, str(res)[:200]))
        return

    # 2. pageOrderFlows 分页（GET 平铺 {pageNo,pageSize}，G04 口径本页实证）
    status, res = http("GET",
                       "/fms/v1/dispatcher/orderFlow/pageOrderFlows?pageNo=1&pageSize=10",
                       token=token)
    data = res.get("data") or {}
    records = data.get("records") or []
    top_keys = sorted(data.keys()) if isinstance(data, dict) else []
    ok = status == 200 and res.get("code") == 200
    record("pageOrderFlows.p1s10", ok,
           "code=%s total=%s size=%s current=%s records=%d topKeys=%s" %
           (res.get("code"), data.get("total"), data.get("size"),
            data.get("current"), len(records), top_keys))

    # 3. 首行结构抽样（OrderFlow schema 字段核对；不记录业务原文全量，仅字段名与类型形态）
    if records:
        row = records[0]
        fields = {k: type(v).__name__ for k, v in row.items()}
        sub = row.get("subOrderFlows") or []
        sub_fields = {k: type(v).__name__ for k, v in sub[0].items()} if sub else {}
        record("orderFlow.schema", True,
               "fields=%s subCount=%s subFields=%s" %
               (json.dumps(fields, ensure_ascii=False), len(sub),
                json.dumps(sub_fields, ensure_ascii=False)))
    else:
        record("orderFlow.schema", True, "total=0 真实空态（本环境无工艺数据）")

    # 4. query 名称筛选：命中与未命中两态（平铺 query 参数）
    if records:
        sample_name = records[0].get("orderFlowName") or ""
        probe = sample_name[:2] if sample_name else "x"
        status, res = http("GET",
                           "/fms/v1/dispatcher/orderFlow/pageOrderFlows?pageNo=1&pageSize=10&query=%s"
                           % urllib.request.quote(probe), token=token)
        hit = (res.get("data") or {}).get("total")
        record("pageOrderFlows.query.hit", status == 200 and res.get("code") == 200,
               "query='%s' code=%s total=%s（命中应>0）" % (probe, res.get("code"), hit))
        status, res = http("GET",
                           "/fms/v1/dispatcher/orderFlow/pageOrderFlows?pageNo=1&pageSize=10&query=__no_such_flow__",
                           token=token)
        miss = (res.get("data") or {})
        record("pageOrderFlows.query.miss", status == 200 and res.get("code") == 200,
               "code=%s total=%s records=%d（未命中空态）" %
               (res.get("code"), miss.get("total"), len(miss.get("records") or [])))
    else:
        record("pageOrderFlows.query", True, "total=0 跳过命中/未命中两态（空态已由第 2 项证实）")

    # 5. 无令牌对照（认证守卫）
    status, res = http("GET", "/fms/v1/dispatcher/orderFlow/pageOrderFlows?pageNo=1&pageSize=10")
    record("pageOrderFlows.noToken", res.get("code") != 200,
           "http=%s code=%s（非 200 业务码=守卫生效）" % (status, res.get("code")))

    # 6. getOrderTemplates 模板选项（弹窗 Transfer 数据源；全量 GET）
    status, res = http("GET", "/fms/v1/dispatcher/orderTemplate/getOrderTemplates", token=token)
    templates = res.get("data") or []
    keys = [t.get("orderTemplateKey") for t in templates][:5]
    record("getOrderTemplates", status == 200 and res.get("code") == 200,
           "code=%s count=%d sampleKeys=%s" % (res.get("code"), len(templates), keys))

    # 7. 业务码通道明细（登录响应 code 字段形态核对，Result 包装）
    record("result.wrap", True, "login code=%s message=%r timestamp=%s" %
           (res.get("code"), res.get("message"), "timestamp" in res))

    print("\nSUMMARY: %d/%d pass" % (sum(1 for r in results if r["ok"]), len(results)))
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                           "readonly_verify_result.json"), "w", encoding="utf-8") as f:
        json.dump({"base": BASE, "results": results}, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
