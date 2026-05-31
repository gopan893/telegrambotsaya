'use strict';

function updatedAtTrigger(tableName) {
  return `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_${tableName}_updated_at'
  ) THEN
    CREATE TRIGGER trg_${tableName}_updated_at
    BEFORE UPDATE ON ${tableName}
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;`;
}

const MIGRATIONS = [
  {
    id: '001_core_users',
    name: 'core users and adaptive profiles',
    sql: [
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        telegram_user_id TEXT UNIQUE,
        chat_id TEXT,
        username TEXT,
        first_name TEXT,
        last_name TEXT,
        role TEXT DEFAULT 'user',
        locale TEXT,
        timezone TEXT,
        settings JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS adaptive_profiles (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        profile JSONB NOT NULL DEFAULT '{}'::jsonb,
        preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
        detected_patterns JSONB NOT NULL DEFAULT '{}'::jsonb,
        confidence NUMERIC DEFAULT 0.5,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE OR REPLACE FUNCTION set_updated_at()
       RETURNS TRIGGER AS $$
       BEGIN
         NEW.updated_at = NOW();
         RETURN NEW;
       END;
       $$ LANGUAGE plpgsql`,
      updatedAtTrigger('users'),
      updatedAtTrigger('adaptive_profiles'),
      'CREATE INDEX IF NOT EXISTS idx_users_telegram_user_id ON users(telegram_user_id)',
      'CREATE INDEX IF NOT EXISTS idx_users_chat_id ON users(chat_id)',
      'CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)',
      'CREATE INDEX IF NOT EXISTS idx_users_last_seen_at ON users(last_seen_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_adaptive_profiles_user_id ON adaptive_profiles(user_id)'
    ]
  },
  {
    id: '002_memory_schema',
    name: 'memory relational schema',
    sql: [
      `CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        summary TEXT,
        tags TEXT[] NOT NULL DEFAULT '{}'::text[],
        source TEXT,
        confidence NUMERIC DEFAULT 0.5,
        importance NUMERIC DEFAULT 0.5,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_accessed_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ
      )`,
      updatedAtTrigger('memories'),
      'CREATE INDEX IF NOT EXISTS idx_memories_user_id ON memories(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type)',
      'CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance DESC)',
      'CREATE INDEX IF NOT EXISTS idx_memories_confidence ON memories(confidence DESC)',
      'CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_memories_last_accessed_at ON memories(last_accessed_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_memories_tags_gin ON memories USING GIN(tags)',
      'CREATE INDEX IF NOT EXISTS idx_memories_metadata_gin ON memories USING GIN(metadata)'
    ]
  },
  {
    id: '003_goal_workflow_schema',
    name: 'goal and workflow relational schema',
    sql: [
      `CREATE TABLE IF NOT EXISTS goals (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'active',
        priority TEXT DEFAULT 'medium',
        progress NUMERIC DEFAULT 0,
        target_date TIMESTAMPTZ,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ
      )`,
      `CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'active',
        context_summary TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ
      )`,
      `CREATE TABLE IF NOT EXISTS workflow_steps (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        step_number INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'pending',
        result TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        UNIQUE(workflow_id, step_number)
      )`,
      updatedAtTrigger('goals'),
      updatedAtTrigger('workflows'),
      updatedAtTrigger('workflow_steps'),
      'CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status)',
      'CREATE INDEX IF NOT EXISTS idx_goals_priority ON goals(priority)',
      'CREATE INDEX IF NOT EXISTS idx_goals_user_status ON goals(user_id, status)',
      'CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON workflows(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status)',
      'CREATE INDEX IF NOT EXISTS idx_workflows_goal_id ON workflows(goal_id)',
      'CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow_id ON workflow_steps(workflow_id)',
      'CREATE INDEX IF NOT EXISTS idx_workflow_steps_step_number ON workflow_steps(step_number)',
      'CREATE INDEX IF NOT EXISTS idx_workflow_steps_status ON workflow_steps(status)'
    ]
  },
  {
    id: '004_graph_schema',
    name: 'knowledge graph relational schema',
    sql: [
      `CREATE TABLE IF NOT EXISTS graph_nodes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        label TEXT NOT NULL,
        type TEXT NOT NULL,
        summary TEXT,
        importance NUMERIC DEFAULT 0.5,
        confidence NUMERIC DEFAULT 0.5,
        source TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )`,
      `CREATE TABLE IF NOT EXISTS graph_edges (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        from_node_id TEXT NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
        to_node_id TEXT NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
        relationship TEXT NOT NULL,
        weight NUMERIC DEFAULT 1.0,
        confidence NUMERIC DEFAULT 0.5,
        evidence TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )`,
      updatedAtTrigger('graph_nodes'),
      updatedAtTrigger('graph_edges'),
      'CREATE INDEX IF NOT EXISTS idx_graph_nodes_user_id ON graph_nodes(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_graph_nodes_type ON graph_nodes(type)',
      'CREATE INDEX IF NOT EXISTS idx_graph_nodes_importance ON graph_nodes(importance DESC)',
      'CREATE INDEX IF NOT EXISTS idx_graph_nodes_last_seen_at ON graph_nodes(last_seen_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_graph_nodes_metadata_gin ON graph_nodes USING GIN(metadata)',
      'CREATE INDEX IF NOT EXISTS idx_graph_edges_user_id ON graph_edges(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_graph_edges_from_node_id ON graph_edges(from_node_id)',
      'CREATE INDEX IF NOT EXISTS idx_graph_edges_to_node_id ON graph_edges(to_node_id)',
      'CREATE INDEX IF NOT EXISTS idx_graph_edges_relationship ON graph_edges(relationship)',
      'CREATE INDEX IF NOT EXISTS idx_graph_edges_metadata_gin ON graph_edges USING GIN(metadata)'
    ]
  },
  {
    id: '005_insight_reflection_schema',
    name: 'insights and reflections relational schema',
    sql: [
      `CREATE TABLE IF NOT EXISTS insights (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        source TEXT,
        related_concepts TEXT[] NOT NULL DEFAULT '{}'::text[],
        confidence NUMERIC DEFAULT 0.5,
        importance NUMERIC DEFAULT 0.5,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )`,
      `CREATE TABLE IF NOT EXISTS reflections (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        topic TEXT,
        content TEXT NOT NULL,
        summary TEXT,
        insights TEXT[] NOT NULL DEFAULT '{}'::text[],
        confidence NUMERIC DEFAULT 0.5,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      updatedAtTrigger('insights'),
      updatedAtTrigger('reflections'),
      'CREATE INDEX IF NOT EXISTS idx_insights_user_id ON insights(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_insights_type ON insights(type)',
      'CREATE INDEX IF NOT EXISTS idx_insights_importance ON insights(importance DESC)',
      'CREATE INDEX IF NOT EXISTS idx_insights_related_concepts_gin ON insights USING GIN(related_concepts)',
      'CREATE INDEX IF NOT EXISTS idx_reflections_user_id ON reflections(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_reflections_type ON reflections(type)'
    ]
  },
  {
    id: '006_research_workspace_schema',
    name: 'research sessions and workspace notes schema',
    sql: [
      `CREATE TABLE IF NOT EXISTS research_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        query TEXT,
        status TEXT DEFAULT 'active',
        summary TEXT,
        findings JSONB NOT NULL DEFAULT '[]'::jsonb,
        sources JSONB NOT NULL DEFAULT '[]'::jsonb,
        confidence NUMERIC DEFAULT 0.5,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      )`,
      `CREATE TABLE IF NOT EXISTS workspace_notes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        content TEXT,
        type TEXT DEFAULT 'note',
        tags TEXT[] NOT NULL DEFAULT '{}'::text[],
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )`,
      updatedAtTrigger('research_sessions'),
      updatedAtTrigger('workspace_notes'),
      'CREATE INDEX IF NOT EXISTS idx_research_sessions_user_id ON research_sessions(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_research_sessions_status ON research_sessions(status)',
      'CREATE INDEX IF NOT EXISTS idx_workspace_notes_user_id ON workspace_notes(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_workspace_notes_type ON workspace_notes(type)',
      'CREATE INDEX IF NOT EXISTS idx_workspace_notes_tags_gin ON workspace_notes USING GIN(tags)'
    ]
  },
  {
    id: '007_ops_telemetry_schema',
    name: 'ops telemetry incidents benchmarks lessons schema',
    sql: [
      `CREATE TABLE IF NOT EXISTS telemetry_events (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        chat_id TEXT,
        event_type TEXT NOT NULL,
        scope TEXT,
        latency_ms INTEGER,
        success BOOLEAN DEFAULT true,
        error_code TEXT,
        model TEXT,
        provider TEXT,
        token_estimate INTEGER,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS incidents (
        id TEXT PRIMARY KEY,
        severity TEXT DEFAULT 'low',
        status TEXT DEFAULT 'open',
        title TEXT NOT NULL,
        description TEXT,
        scope TEXT,
        error_code TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        resolved_at TIMESTAMPTZ
      )`,
      `CREATE TABLE IF NOT EXISTS benchmark_runs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT DEFAULT 'completed',
        score NUMERIC,
        result JSONB NOT NULL DEFAULT '{}'::jsonb,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS ops_lessons (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        source TEXT,
        confidence NUMERIC DEFAULT 0.5,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      updatedAtTrigger('incidents'),
      updatedAtTrigger('ops_lessons'),
      'CREATE INDEX IF NOT EXISTS idx_telemetry_events_event_type ON telemetry_events(event_type)',
      'CREATE INDEX IF NOT EXISTS idx_telemetry_events_scope ON telemetry_events(scope)',
      'CREATE INDEX IF NOT EXISTS idx_telemetry_events_created_at ON telemetry_events(created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_telemetry_events_success ON telemetry_events(success)',
      'CREATE INDEX IF NOT EXISTS idx_telemetry_events_provider ON telemetry_events(provider)',
      'CREATE INDEX IF NOT EXISTS idx_telemetry_events_user_id ON telemetry_events(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status)',
      'CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity)',
      'CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON incidents(created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_benchmark_runs_created_at ON benchmark_runs(created_at DESC)'
    ]
  },
  {
    id: '008_kv_compat_schema',
    name: 'kv compatibility schema',
    sql: [
      `CREATE TABLE IF NOT EXISTS app_kv_store (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      updatedAtTrigger('app_kv_store'),
      'CREATE INDEX IF NOT EXISTS idx_app_kv_store_updated_at ON app_kv_store(updated_at DESC)',
      `DO $$
       BEGIN
         IF to_regclass('public.bot_kv') IS NOT NULL THEN
           EXECUTE 'INSERT INTO app_kv_store(key, value, updated_at)
                    SELECT key, value, updated_at FROM bot_kv
                    ON CONFLICT (key) DO NOTHING';
         END IF;
       END $$;`
    ]
  }
];

module.exports = {
  MIGRATIONS,
  updatedAtTrigger
};
