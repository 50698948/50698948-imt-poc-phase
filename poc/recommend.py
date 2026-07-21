"""
Engineer Task Recommendation Engine.

Generates actionable task items for the incident handler based on:
  1. Current ticket state (status, error_type, severity)
  2. Similar historical tickets' action_plans and resolutions
  3. Best-practice SRE patterns for the specific error_type

Tasks are human-revisable — status, notes, and descriptions can be manually updated.
"""

TASK_TEMPLATES = {
    "timeout": [
        "Check connection pool metrics (active/idle/pending) for {service_name}",
        "Review slow query / request logs for long-running operations",
        "Verify recent deployment diff for changes to {service_name}",
        "Check downstream service latency (traces/spans) for {service_name}",
        "Run capacity check: is {service_name} within auto-scaling limits?",
    ],
    "OOM": [
        "Capture heap dump or memory profile of {service_name}",
        "Check if recent deployment increased memory footprint",
        "Review GC logs / memory metrics for leak patterns",
        "Verify container/pod memory limits for {service_name}",
        "Identify top memory-consuming objects via profiler",
    ],
    "deadlock": [
        "Capture deadlock logs from database (pg_stat_activity / SHOW ENGINE INNODB STATUS)",
        "Audit transaction lock ordering in {service_name} code paths",
        "Identify concurrent code paths touching the same resources",
        "Review isolation level settings for {service_name}",
        "Add retry with exponential backoff for deadlock-prone operations",
    ],
    "race_condition": [
        "Identify shared mutable state in {service_name} request handlers",
        "Audit concurrent write paths to the same data records",
        "Review idempotency handling for webhooks and async callbacks",
        "Add pessimistic locking (SELECT ... FOR UPDATE) or CAS pattern",
        "Write integration test reproducing the race scenario",
    ],
    "resource_exhaustion": [
        "Identify which resource is exhausted (disk/memory/file descriptors/connections)",
        "Check system resource limits and current usage",
        "Review auto-scaling policies and thresholds",
        "Audit cleanup/garbage-collection processes for {service_name}",
        "Set up alerting at 70% and 85% resource utilization",
    ],
    "auth_error": [
        "Check certificate / token expiry dates for {service_name}",
        "Verify IAM roles and permissions for {service_name}",
        "Review authentication service health and latency",
        "Check if credential rotation was recently performed",
        "Test auth flow manually with different credential scenarios",
    ],
    "rate_limit": [
        "Check current rate-limit configuration for {service_name}",
        "Identify which client/endpoint is triggering the limit",
        "Review traffic pattern changes (seasonal? new deployment?)",
        "Implement exponential backoff and jitter for client retries",
        "Consider rate-limit tiering or quota increase for critical paths",
    ],
}

DEFAULT_TASKS = [
    "Assess blast radius: identify all affected services and users",
    "Check recent deployments or config changes for {service_name}",
    "Collect relevant logs, metrics, and traces for {service_name}",
    "Set up a monitoring dashboard for {service_name} key metrics",
    "Prepare communication to stakeholders (status page / Slack / email)",
]


def generate_recommendations(
    ticket: dict,
    similar_tickets: list[dict],
) -> list[dict]:
    """Generate recommended task items for the incident handler.

    Returns a list of dicts with: task_order, description, source.
    """
    tasks: list[dict] = []
    order = 1
    error_type = ticket.get("error_type", "")
    service = ticket.get("service_name", "unknown")

    # 1. Add error-type specific tasks from templates
    templates = TASK_TEMPLATES.get(error_type, [])
    for tpl in templates[:3]:
        tasks.append({
            "task_order": order,
            "description": tpl.format(service_name=service),
            "source": f"best-practice/{error_type}",
        })
        order += 1

    # 2. Add general investigation tasks
    gen = DEFAULT_TASKS[: (7 - len(tasks)) if len(tasks) < 5 else 2]
    for tpl in gen:
        tasks.append({
            "task_order": order,
            "description": tpl.format(service_name=service),
            "source": "sre-playbook/general",
        })
        order += 1

    # 3. Add tasks derived from similar tickets' action_plans
    seen = set()
    for sim in similar_tickets[:3]:
        ap = sim.get("action_plan", "")
        if not ap:
            continue
        for line in ap.split("\n"):
            line = line.strip()
            if not line or not line[0].isdigit():
                continue
            cleaned = line.split(". ", 1)[-1] if ". " in line else line[2:].strip()
            key = cleaned[:50]
            if key not in seen and len(tasks) < 7:
                seen.add(key)
                tasks.append({
                    "task_order": order,
                    "description": cleaned[:200],
                    "source": sim.get("incident_no", "?"),
                })
                order += 1

    # 4. Add root-cause-specific task if root_cause is known
    if ticket.get("root_cause"):
        tasks.append({
            "task_order": order,
            "description": "Confirm root cause hypothesis: " + ticket["root_cause"][:150],
            "source": "current-investigation",
        })
        order += 1

    return tasks
