"""
运行控制器的命令行集成烟测：在系统临时目录创建独立的小型 Git 仓库。
只验证锁、状态及本地裸仓库推送，不请求业务后端；夹具不作为业务验收证据。
不引入单元测试框架，不修改目标项目的队列、分支或锁。
"""
import copy
import hashlib
import json
import pathlib
import shutil
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
results = []


def call(*args, expected=0):
    result = subprocess.run(args, cwd=WORK, text=True, encoding='utf-8', capture_output=True)
    if result.returncode != expected:
        raise RuntimeError(f'{args}: exit={result.returncode}; {result.stderr}')
    return result.stdout.strip()


def cli(*args, expected=0):
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

    commands = [['node', 'scripts/migration-runner.mjs', 'begin', '--run', f'concurrent-{i}', '--session', 'isolated-cli-smoke', '--task', 'T00'] for i in range(2)]
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
    write('proof.json', {'runId': 'recovery-smoke', 'ended': True, 'kind': 'runner_terminal_state', 'reference': '隔离烟测调用进程已退出；不存在业务 Agent', 'checkedAt': datetime.now(timezone.utc).isoformat()})
    cli('recover', '--run', 'recovery-smoke', '--proof', 'proof.json')
    assert state()['run'] is None and not (WORK / 'docs/migration/.lock').exists()
    passed('不匹配证明拒绝；对应终态证明归档后恢复')

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
    assert json.loads(cli('status'))['next'] == {'taskId': 'T00', 'purpose': 'audit'}
    cli('check', expected=1)
    (WORK / 'code.txt').write_text('control fixture\n', encoding='utf-8')
    passed('49 条完整矩阵可投影；受检文件变化转复核且 check 拒绝旧证据')

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
finally:
    REPORT.write_text(json.dumps({'scope': '控制器命令行集成烟测，不是业务验收或单元测试', 'checkedAt': datetime.now(timezone.utc).isoformat(), 'runnerSha256': hashlib.sha256((ROOT / 'scripts/migration-runner.mjs').read_bytes()).hexdigest(), 'passedCases': len(results), 'results': results}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'passedCases': len(results), 'report': str(REPORT)}, ensure_ascii=True))
