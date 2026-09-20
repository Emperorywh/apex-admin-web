"""
运行控制器的命令行集成烟测：在系统临时目录创建独立的小型 Git 仓库。
只验证锁、状态及本地裸仓库推送，不请求业务后端；夹具不作为业务验收证据。
不引入单元测试框架，不修改目标项目的队列、分支或锁。
"""
import copy
import hashlib
import json
import os
import pathlib
import shutil
import sqlite3
import subprocess
import tempfile
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[4]
REPORT = pathlib.Path(__file__).with_name('smoke-results.json')
SANDBOX = pathlib.Path(tempfile.mkdtemp(prefix='migration-runner-smoke-')).resolve()
WORK = SANDBOX / 'work'
WORK.mkdir()
(WORK / 'scripts').mkdir()
(WORK / 'docs/migration/evidence').mkdir(parents=True)
shutil.copyfile(ROOT / 'scripts/migration-runner.mjs', WORK / 'scripts/migration-runner.mjs')
shutil.copyfile(ROOT / 'scripts/migration-zcode.mjs', WORK / 'scripts/migration-zcode.mjs')
SESSION = '00000000-0000-0000-0000-000000000000'
results = []


def call(*args, expected=0):
    result = subprocess.run(args, cwd=WORK, text=True, encoding='utf-8', capture_output=True)
    if result.returncode != expected:
        raise RuntimeError(f'{args}: exit={result.returncode}; {result.stderr}')
    return result.stdout.strip()


def cli(*args, expected=0):
    args = tuple(SESSION if arg == 'isolated-cli-smoke' else arg for arg in args)
    return call('node', 'scripts/migration-runner.mjs', *args, expected=expected)


def write(path, value):
    target = WORK / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')


def state():
    return json.loads((WORK / 'docs/migration/RUN_STATE.json').read_text(encoding='utf-8'))


def passed(name):
    results.append({'case': name, 'status': 'passed'})


def checkpoint(run_id, patch, expected=0, revision=None):
    write('patch.json', patch)
    return cli('checkpoint', '--run', run_id, '--revision', str(state()['revision'] if revision is None else revision), '--file', 'patch.json', expected=expected)


try:
    # 所有 Git 操作只使用此隔离仓库；远端为同一临时目录中的本地裸仓库。
    # 模拟清单只证明控制器门禁行为，不宣称任何迁移任务已实际验收。
    call('git', 'init', '-b', 'smoke')
    call('git', 'config', 'user.name', 'Migration smoke')
    call('git', 'config', 'user.email', 'smoke@localhost')
    (WORK / 'code.txt').write_text('control fixture\n', encoding='utf-8')
    call('git', 'add', 'code.txt')
    call('git', 'commit', '-m', 'control fixture')
    head = call('git', 'rev-parse', 'HEAD')
    call('git', 'init', '--bare', str(SANDBOX / 'remote.git'))
    call('git', 'remote', 'add', 'origin', str(SANDBOX / 'remote.git'))
    call('git', 'push', 'origin', 'HEAD:refs/heads/smoke')
    seed = copy.deepcopy(json.loads((ROOT / 'docs/migration/RUN_STATE.json').read_text(encoding='utf-8')))
    seed.update(revision=0, run=None, lastRun=None, currentTaskId=None)
    seed['workspace'] = {'root': str(WORK), 'branch': 'smoke', 'remote': 'origin', 'remoteBranch': 'smoke'}
    seed['publish'] = {'status': 'synced', 'commit': head}
    for task in seed['queue']:
        task.update(implementation='not_started', verification='not_started', gate='blocked', acceptanceRecord=None)
    write('docs/migration/RUN_STATE.json', seed)
    (WORK / 'TASKS.md').write_text('\n'.join(f'- [ ] **{task["id"]} fixture**' for task in seed['queue']), encoding='utf-8')
    cli('check')
    passed('48 项队列与复选框投影校验')

    commands = [['node', 'scripts/migration-runner.mjs', 'begin', '--run', f'concurrent-{i}', '--session', SESSION, '--task', 'T00'] for i in range(2)]
    processes = [subprocess.Popen(command, cwd=WORK, text=True, encoding='utf-8', stdout=subprocess.PIPE, stderr=subprocess.PIPE) for command in commands]
    for process in processes:
        process.communicate()
    assert sorted(process.returncode for process in processes) == [0, 1]
    winner = state()['run']['runId']
    passed('两个独立 Node 进程争锁仅一个成功')
    cli('end', '--run', 'wrong-owner', '--outcome', 'checkpoint', expected=1)
    assert (WORK / 'docs/migration/.lock/lock.json').exists()
    passed('错误运行不能释放别人的锁')
    checkpoint(winner, {'progress': ['stale']}, expected=1, revision=0)
    checkpoint(winner, {'progress': ['checkpoint saved']})
    assert state()['run']['progress'] == ['checkpoint saved']
    passed('过期修订号拒绝；有效检查点原子保存')
    checkpoint(winner, {'task': {'implementation': 'implemented', 'verification': 'passed', 'gate': 'ready'}}, expected=1)
    assert state()['queue'][0]['verification'] != 'passed'
    passed('缺少验收记录不能勾选或放行')
    cli('end', '--run', winner, '--outcome', 'checkpoint')
    assert not (WORK / 'docs/migration/.lock').exists()
    assert (WORK / f'docs/migration/evidence/runs/{winner}.json').exists()
    passed('结束记录先落盘，再释放本轮锁')

    cli('begin', '--run', 'recovery-smoke', '--session', 'isolated-cli-smoke', '--task', 'T00')
    write('proof.json', {'runId': 'another-run', 'ended': True})
    cli('recover', '--run', 'recovery-smoke', '--proof', 'proof.json', expected=1)
    write('proof.json', {'runId': 'recovery-smoke', 'ended': True, 'kind': 'user_confirmation', 'reference': '仅隔离烟测人工恢复分支的输入夹具，不代表真实业务授权', 'checkedAt': datetime.now(timezone.utc).isoformat()})
    cli('recover', '--run', 'recovery-smoke', '--proof', 'proof.json', '--session', SESSION)
    assert state()['run'] is None and not (WORK / 'docs/migration/.lock').exists()
    passed('不匹配证明拒绝；人工恢复分支保留证明后释放')

    # 本地提交变化必须转入交付轮，重复核验不能创建新提交或重复业务操作。
    # 这一步只把一个文本提交推送至临时裸仓库，无任何网络推送。
    (WORK / 'delivery.txt').write_text('delivery fixture\n', encoding='utf-8')
    call('git', 'add', 'delivery.txt')
    call('git', 'commit', '-m', 'delivery fixture')
    delivered_head = call('git', 'rev-parse', 'HEAD')
    assert json.loads(cli('status'))['next']['purpose'] == 'delivery'
    cli('begin', '--run', 'delivery-smoke', '--session', 'isolated-cli-smoke', '--task', 'T00', '--purpose', 'delivery')
    checkpoint('delivery-smoke', {'task': {'implementation': 'implemented'}}, expected=1)
    cli('push', '--run', 'delivery-smoke', '--commit', delivered_head)
    cli('verify-remote', '--run', 'delivery-smoke')
    assert state()['publish']['confirmedRemoteHead'] == delivered_head
    cli('end', '--run', 'delivery-smoke', '--outcome', 'checkpoint')
    passed('提交后中断优先交付；本地推送及重复核验幂等；交付轮禁止改业务状态')

    # 构造标有 fixture 的完整矩阵，验证控制器对缺项与代码变更的判断。
    # 全部夹具保存在临时仓库，绝不写入真实任务的 acceptanceRecord。
    item_ids = ['TASK'] + [f'DoD{i}' for i in range(1, 17)] + [f'A{i:02d}' for i in range(1, 25)] + [f'I{i:02d}' for i in range(1, 9)]
    record = {'taskId': 'T00', 'codeCommit': delivered_head, 'codeFiles': [{'path': 'code.txt', 'sha256': hashlib.sha256((WORK / 'code.txt').read_bytes()).hexdigest()}], 'items': [{'id': item, 'status': 'passed', 'reason': '仅控制器夹具', 'evidence': ['code.txt']} for item in item_ids], 'releaseChecks': {key: 'passed' for key in ['scope', 'static', 'readOnly', 'ui', 'sharedConsumers']}}
    write('docs/migration/evidence/T00.json', record)
    cli('begin', '--run', 'evidence-smoke', '--session', 'isolated-cli-smoke', '--task', 'T00')
    checkpoint('evidence-smoke', {'task': {'implementation': 'implemented', 'verification': 'passed', 'gate': 'ready', 'acceptanceRecord': 'docs/migration/evidence/T00.json'}})
    assert '- [x] **T00' in (WORK / 'TASKS.md').read_text(encoding='utf-8')
    cli('check')
    cli('end', '--run', 'evidence-smoke', '--outcome', 'completed')
    (WORK / 'code.txt').write_text('changed fixture\n', encoding='utf-8')
    assert json.loads(cli('status'))['next']['taskId'] == 'P01'
    cli('check', expected=1)
    (WORK / 'code.txt').write_text('control fixture\n', encoding='utf-8')
    passed('49 条完整矩阵可投影；check 拒绝过期证据，开发顺序不被历史复核抢占')

    final_state = state()
    for task in final_state['queue'][:-1]:
        example = copy.deepcopy(record)
        example['taskId'] = task['id']
        if task['id'] == 'T00':
            example['items'][0].update(status='deferred', category='site_acceptance', basis='fixture only', owner='fixture', resumeCondition='fixture')
        path = f'docs/migration/evidence/{task["id"]}.json'
        write(path, example)
        task.update(implementation='implemented', verification='partial' if task['id'] == 'T00' else 'passed', gate='ready', acceptanceRecord=path)
    final_state['currentTaskId'] = 'V01'
    write('docs/migration/RUN_STATE.json', final_state)
    assert json.loads(cli('status'))['next'] == {'taskId': 'T00', 'purpose': 'acceptance'}
    passed('V01 前先逐任务补验，避免总验收阶段串行死锁')

    # 使用隔离 SQLite 记录复现真实的取消遗锁；数据库及会话均为控制器夹具。
    # 覆盖未知、活动、排队与终态，不以时间流逝替代可证实的运行状态。
    fresh = copy.deepcopy(seed)
    fresh['publish'] = {'status': 'synced', 'commit': delivered_head}
    write('docs/migration/RUN_STATE.json', fresh)
    cli('begin', '--run', 'invalid-session', '--session', 'zcode-p41-audit', '--task', 'T00', expected=1)
    assert not (WORK / 'docs/migration/.lock').exists()
    passed('自拟 session 名称在取锁前被拒绝')
    zhome = SANDBOX / 'zcode'
    (zhome / 'v2').mkdir(parents=True)
    (zhome / 'cli/db').mkdir(parents=True)
    os.environ['MIGRATION_ZCODE_HOME'] = str(zhome)
    idx = sqlite3.connect(zhome / 'v2/tasks-index.sqlite')
    db = sqlite3.connect(zhome / 'cli/db/db.sqlite')
    idx.executescript('CREATE TABLE tasks(task_id TEXT, task_status TEXT, workspace_path TEXT, updated_at INTEGER); CREATE TABLE automation_runs(run_id TEXT, session_id TEXT, outcome TEXT, updated_at INTEGER, created_at INTEGER);')
    db.executescript('CREATE TABLE session(id TEXT, directory TEXT); CREATE TABLE message(id TEXT, session_id TEXT, data TEXT); CREATE TABLE part(id TEXT, session_id TEXT, message_id TEXT, data TEXT); CREATE TABLE turn_usage(session_id TEXT, turn_id TEXT, status TEXT, started_at INTEGER, completed_at INTEGER); CREATE TABLE tool_usage(session_id TEXT, tool_call_id TEXT, turn_id TEXT, status TEXT); CREATE TABLE session_input(session_id TEXT, status TEXT);')
    old_sid = 'sess_00000000-0000-0000-0000-000000000001'
    new_sid = 'sess_00000000-0000-0000-0000-000000000002'
    new_turn = 'turn_00000000-0000-0000-0000-000000000002'
    for sid, label, task_status, outcome, turn_status in [(old_sid, 'old', 'completed', 'succeeded', 'running'), (new_sid, 'new', 'running', 'running', 'running')]:
        idx.execute('INSERT INTO tasks VALUES(?,?,?,?)', (sid, task_status, str(WORK), 2))
        idx.execute('INSERT INTO automation_runs VALUES(?,?,?,?,?)', (label+'-auto', sid, outcome, 2, 1))
        db.execute('INSERT INTO session VALUES(?,?)', (sid, str(WORK)))
        db.execute('INSERT INTO turn_usage VALUES(?,?,?,?,?)', (sid, new_turn if sid == new_sid else label+'-turn', turn_status, 1, None))
    prepare_part = {'type': 'tool', 'tool': 'Bash', 'callID': 'prepare-call', 'state': {'status': 'running', 'input': {'command': 'node scripts/migration-runner.mjs prepare --session auto'}}}
    db.execute('INSERT INTO message VALUES(?,?,?)', ('prepare-message', new_sid, json.dumps({'role': 'assistant', 'anchor': {'turnId': new_turn}})))
    db.execute('INSERT INTO part VALUES(?,?,?,?)', ('prepare-part', new_sid, 'prepare-message', json.dumps(prepare_part)))
    idx.commit(); db.commit()
    cli('begin', '--run', 'legacy-cancelled', '--session', SESSION, '--task', 'T00')
    lock = json.loads((WORK / 'docs/migration/.lock/lock.json').read_text(encoding='utf-8'))
    lock.pop('runner')
    lock['owner'] = 'zcode-t00-legacy-name'
    write('docs/migration/.lock/lock.json', lock)
    before_probe = (WORK / 'docs/migration/RUN_STATE.json').read_bytes()
    assert json.loads(cli('prepare', '--session', 'auto'))['action'] == 'blocked'
    assert (WORK / 'docs/migration/RUN_STATE.json').read_bytes() == before_probe
    passed('无法绑定真实会话的旧锁保持原样')
    part = {'type': 'tool', 'callID': 'begin-call', 'state': {'status': 'completed', 'input': {'command': 'node scripts/migration-runner.mjs begin --run legacy-cancelled'}, 'output': json.dumps(state()['run'])}}
    db.execute('INSERT INTO part VALUES(?,?,?,?)', ('begin-part', old_sid, None, json.dumps(part)))
    db.execute('INSERT INTO tool_usage VALUES(?,?,?,?)', (old_sid, 'begin-call', 'old-turn', 'completed'))
    db.commit()
    assert json.loads(cli('prepare', '--session', 'auto'))['action'] == 'blocked'
    db.execute("UPDATE turn_usage SET status='cancelled', completed_at=2 WHERE session_id=?", (old_sid,))
    db.execute('INSERT INTO tool_usage VALUES(?,?,?,?)', (old_sid, 'pending-tool', 'old-turn', 'running')); db.commit()
    assert json.loads(cli('prepare', '--session', 'auto'))['action'] == 'blocked'
    db.execute("UPDATE tool_usage SET status='completed' WHERE tool_call_id='pending-tool'")
    db.execute('INSERT INTO session_input VALUES(?,?)', (old_sid, 'admitted')); db.commit()
    assert json.loads(cli('prepare', '--session', 'auto'))['action'] == 'blocked'
    assert (WORK / 'docs/migration/RUN_STATE.json').read_bytes() == before_probe
    passed('会话看似完成但轮次、工具或排队输入仍活动时拒绝恢复')
    db.execute("UPDATE session_input SET status='cancelled' WHERE session_id=?", (old_sid,)); db.commit()
    # 统计已经全部结束仍不代表工具停止：模拟重新唤醒后统计尚未落库。
    # 实时工具记录活动时必须保持旧锁，不能误把缺失的 usage 当作终态。
    db.execute('INSERT INTO part VALUES(?,?,?,?)', ('resumed-part', old_sid, None, json.dumps(prepare_part))); db.commit()
    assert json.loads(cli('prepare', '--session', 'auto'))['action'] == 'blocked'
    assert (WORK / 'docs/migration/RUN_STATE.json').read_bytes() == before_probe
    db.execute("DELETE FROM part WHERE id='resumed-part'"); db.commit()
    passed('重新唤醒但工具统计未落库时，实时工具记录阻止恢复旧锁')
    guard = {'runId': 'recovery-fixture', 'runner': {'provider': 'zcode', 'sessionId': new_sid, 'turnId': new_turn, 'automationRunId': 'new-auto'}}
    write('docs/migration/.lock/recovery.lock', guard)
    cli('prepare', '--session', 'auto', expected=1)
    cli('sync', '--run', 'legacy-cancelled', expected=1)
    assert (WORK / 'docs/migration/RUN_STATE.json').read_bytes() == before_probe
    guard['runner'] = {'provider': 'zcode', 'sessionId': old_sid, 'turnId': 'old-turn', 'automationRunId': 'old-auto'}
    write('docs/migration/.lock/recovery.lock', guard)
    resumed = json.loads(cli('prepare', '--session', 'auto'))
    assert resumed['taskId'] == 'T00' and resumed['purpose'] == 'implement'
    assert resumed['runner']['sessionId'] == new_sid and resumed['runner']['turnId'] == new_turn
    recovered = json.loads((WORK / 'docs/migration/evidence/recovery/legacy-cancelled.json').read_text(encoding='utf-8'))
    assert recovered['proof']['binding']['beginPartId'] == 'begin-part'
    assert recovered['proof']['turn']['status'] == 'cancelled'
    cli('end', '--run', resumed['runId'], '--outcome', 'checkpoint')
    passed('成功 begin 绑定取消轮次；同轮恢复并领取开发任务，保存真实新会话身份')
    passed('活动恢复短锁保持互斥；恢复者已终止后可清理短锁继续恢复')

    # 复现真实故障：当前 turn_usage 零条，另一个历史自动轮滞留 running。
    # 只能通过正在执行的工具及消息锚点确认本轮，不能依赖统计或最新时间。
    db.execute('DELETE FROM turn_usage WHERE session_id=?', (new_sid,))
    idx.execute("UPDATE tasks SET task_status='running' WHERE task_id=?", (old_sid,))
    idx.execute("UPDATE automation_runs SET outcome='running' WHERE session_id=?", (old_sid,))
    idx.commit(); db.commit()
    resumed = json.loads(cli('prepare', '--session', 'auto'))
    assert resumed['runner']['sessionId'] == new_sid and resumed['runner']['identitySource'] == 'running_tool_part'
    assert resumed['runner']['toolPartId'] == 'prepare-part' and resumed['runner']['turnId'] == new_turn
    cli('end', '--run', resumed['runId'], '--outcome', 'checkpoint')
    passed('当前轮无 usage 且历史自动轮滞留 running，仍按实时工具准确领取')

    before_identity = (WORK / 'docs/migration/RUN_STATE.json').read_bytes()
    for bad in [dict(prepare_part, state={**prepare_part['state'], 'status': 'completed'}),
                dict(prepare_part, state={**prepare_part['state'], 'input': {'command': 'echo node scripts/migration-runner.mjs prepare --session auto'}})]:
        db.execute('UPDATE part SET data=? WHERE id=?', (json.dumps(bad), 'prepare-part')); db.commit()
        cli('prepare', '--session', 'auto', expected=1)
        assert (WORK / 'docs/migration/RUN_STATE.json').read_bytes() == before_identity and not (WORK / 'docs/migration/.lock').exists()
    db.execute('UPDATE part SET data=? WHERE id=?', (json.dumps(prepare_part), 'prepare-part'))
    db.execute('INSERT INTO turn_usage VALUES(?,?,?,?,?)', (new_sid, new_turn, 'completed', 1, 2)); db.commit()
    cli('prepare', '--session', 'auto', expected=1)
    db.execute('DELETE FROM turn_usage WHERE session_id=?', (new_sid,)); db.commit()
    passed('已完成工具、仅文本提及命令和已结束轮次均不能冒充当前执行')

    db.execute('INSERT INTO message VALUES(?,?,?)', ('ambiguous-message', old_sid, json.dumps({'role': 'assistant', 'anchor': {'turnId': 'turn_00000000-0000-0000-0000-000000000003'}})))
    db.execute('INSERT INTO part VALUES(?,?,?,?)', ('ambiguous-part', old_sid, 'ambiguous-message', json.dumps(prepare_part))); db.commit()
    cli('prepare', '--session', 'auto', expected=1)
    assert (WORK / 'docs/migration/RUN_STATE.json').read_bytes() == before_identity and not (WORK / 'docs/migration/.lock').exists()
    db.execute("DELETE FROM part WHERE id='ambiguous-part'"); db.commit()
    passed('两个真实工具同时匹配时拒绝猜最新会话且不写状态')

    db.execute("UPDATE session SET directory='C:/wrong-workspace' WHERE id=?", (new_sid,)); db.commit()
    cli('prepare', '--session', 'auto', expected=1)
    db.execute('UPDATE session SET directory=? WHERE id=?', (str(WORK), new_sid))
    db.execute("UPDATE message SET data='{}' WHERE id='prepare-message'"); db.commit()
    cli('prepare', '--session', 'auto', expected=1)
    assert (WORK / 'docs/migration/RUN_STATE.json').read_bytes() == before_identity and not (WORK / 'docs/migration/.lock').exists()
    passed('会话目录不符或消息缺少真实轮次锚点时拒绝领取')
    idx.close(); db.close()
    fresh['publish'] = {'status': 'synced', 'commit': head}
    fresh['currentTaskId'] = 'V01'
    write('docs/migration/RUN_STATE.json', fresh)
    reconciled = json.loads(cli('prepare', '--session', SESSION))
    assert reconciled['taskId'] == 'T00' and reconciled['purpose'] == 'implement'
    assert state()['publish']['commit'] == delivered_head
    assert json.loads(cli('status'))['next'] is None
    cli('end', '--run', reconciled['runId'], '--outcome', 'checkpoint')
    passed('远端已同步的旧回执同轮修正；V01 不抢占未开发页面；持锁不显示可领取 next')
finally:
    REPORT.write_text(json.dumps({'scope': '控制器命令行集成烟测，不是业务验收或单元测试', 'checkedAt': datetime.now(timezone.utc).isoformat(), 'runnerSha256': hashlib.sha256((ROOT / 'scripts/migration-runner.mjs').read_bytes()).hexdigest(), 'zcodeAdapterSha256': hashlib.sha256((ROOT / 'scripts/migration-zcode.mjs').read_bytes()).hexdigest(), 'passedCases': len(results), 'expectedCases': 21, 'status': 'passed' if len(results) == 21 else 'failed', 'results': results}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'passedCases': len(results), 'report': str(REPORT)}, ensure_ascii=True))
