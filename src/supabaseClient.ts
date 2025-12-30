import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://igortawzsqlyyktnhybv.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_1U2HHp6TWWaFReCrV1CYgg_0dV4BbCQ";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
