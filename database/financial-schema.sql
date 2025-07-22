-- Financial data schema additions for Arnaldo AI

-- Add financial fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_income DECIMAL(10,2);
ALTER TABLE users ADD COLUMN IF NOT EXISTS payday INTEGER CHECK (payday >= 1 AND payday <= 31);
ALTER TABLE users ADD COLUMN IF NOT EXISTS family_size INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_subscriber BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_started_at TIMESTAMP WITH TIME ZONE;

-- Expenses tracking table
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  category VARCHAR(50),
  description TEXT,
  expense_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, expense_date);

-- Financial goals table
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- emergency_fund, dream_purchase, debt_payment
  name VARCHAR(255),
  target_amount DECIMAL(10,2) NOT NULL,
  current_amount DECIMAL(10,2) DEFAULT 0,
  target_date DATE,
  status VARCHAR(20) DEFAULT 'active', -- active, completed, abandoned
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_goals_user_status ON goals(user_id, status);

-- Daily summaries for quick access
CREATE TABLE IF NOT EXISTS daily_summaries (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  summary_date DATE NOT NULL,
  total_spent DECIMAL(10,2) DEFAULT 0,
  daily_budget DECIMAL(10,2),
  expense_count INTEGER DEFAULT 0,
  categories JSONB, -- {"alimentação": 50.00, "transporte": 15.00}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, summary_date)
);

-- User insights and notifications
CREATE TABLE IF NOT EXISTS insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- weekly_summary, saving_tip, goal_progress, overspending_alert
  content TEXT NOT NULL,
  metadata JSONB,
  delivered BOOLEAN DEFAULT FALSE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insights_user_delivered ON insights(user_id, delivered);

-- Analytics events for tracking user behavior
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_name VARCHAR(100) NOT NULL,
  properties JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_user_event ON analytics_events(user_id, event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_events(created_at);

-- Referrals for viral growth tracking
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  referred_phone_number VARCHAR(20) NOT NULL,
  referred_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, completed, expired
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created 
  ON messages(conversation_id, created_at DESC);

-- Create a simple index on expense_date instead of using DATE_TRUNC
CREATE INDEX IF NOT EXISTS idx_expenses_user_month 
  ON expenses(user_id, expense_date);

-- Helper functions
CREATE OR REPLACE FUNCTION update_daily_summary()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO daily_summaries (
    user_id, 
    summary_date, 
    total_spent, 
    expense_count,
    categories
  )
  VALUES (
    NEW.user_id,
    NEW.expense_date,
    NEW.amount,
    1,
    jsonb_build_object(COALESCE(NEW.category, 'outros'), NEW.amount)
  )
  ON CONFLICT (user_id, summary_date) DO UPDATE SET
    total_spent = daily_summaries.total_spent + NEW.amount,
    expense_count = daily_summaries.expense_count + 1,
    categories = daily_summaries.categories || 
      jsonb_build_object(COALESCE(NEW.category, 'outros'), 
        COALESCE((daily_summaries.categories->>COALESCE(NEW.category, 'outros'))::numeric, 0) + NEW.amount
      );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update daily summaries
CREATE TRIGGER update_daily_summary_trigger
AFTER INSERT ON expenses
FOR EACH ROW
EXECUTE FUNCTION update_daily_summary();