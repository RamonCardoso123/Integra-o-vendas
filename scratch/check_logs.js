const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
  if (match) {
    let value = match[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    envVars[match[1]] = value;
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  try {
    console.log('--- BUSCANDO TRIGGERS DA TABELA EMPRESAS ---');
    const { data: triggers, error: errTrig } = await supabase
      .rpc('executar_sql_temporario', {
        query_sql: `
          SELECT 
            tgname AS trigger_name,
            proname AS function_name,
            tgtype AS trigger_type
          FROM pg_trigger
          JOIN pg_class ON pg_class.oid = tgrelid
          JOIN pg_proc ON pg_proc.oid = tgfoid
          WHERE relname = 'empresas';
        `
      });

    if (errTrig) {
      // Se não houver RPC, tentamos uma query via select caso tenhamos exposto algo, ou apenas informamos
      console.warn('RPC executar_sql_temporario não disponível. Tentando buscar triggers via query direta...');
      const { data: triggersDirect, error: errTrig2 } = await supabase
        .from('pg_trigger')
        .select('*')
        .limit(1); // Apenas para teste
      
      if (errTrig2) {
        console.error('Não é possível consultar pg_trigger diretamente por REST API. Detalhes:', errTrig2.message);
      }
    } else {
      console.table(triggers);
    }

    console.log('--- DETALHE DO CARD DA EMPRESA NUFAST ---');
    const { data: empresa, error: errEmp } = await supabase
      .from('empresas')
      .select('*')
      .eq('id', '0a3d94dd-5181-49b5-90de-a3ab615e5b46')
      .single();

    if (errEmp) throw errEmp;
    console.log(JSON.stringify(empresa, null, 2));

  } catch (error) {
    console.error('Erro geral:', error);
  }
}

run();
