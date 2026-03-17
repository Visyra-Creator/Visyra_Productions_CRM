import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
)

const tables = [
  "clients",
  "leads",
  "payments",
  "expenses",
  "packages",
  "locations",
  "portfolio",
  "shoots",
  "app_options"
]

async function testConnection() {
  console.log("\n🔎 Testing Supabase connection...\n")

  for (const table of tables) {
    const { error } = await supabase.from(table).select("*").limit(1)

    if (error) {
      console.error(`❌ Table check failed: ${table}`, error.message)
    } else {
      console.log(`✅ Table OK: ${table}`)
    }
  }
}

async function testInsertLead() {
  console.log("\n🔎 Testing lead insert...\n")

  const { error } = await supabase.from("leads").insert({
    name: "Test Lead",
    phone: "9999999999"
  })

  if (error) {
    console.error("❌ Lead insert failed", error.message)
  } else {
    console.log("✅ Lead insert works")
  }
}

async function runTests() {
  await testConnection()
  await testInsertLead()
}
async function testWorkflow() {
  const { data: client } = await supabase
    .from("clients")
    .insert({ name: "Workflow Client" })
    .select()
    .single()

  const { error } = await supabase.from("shoots").insert({
    client_id: client.id
  })

  if (error) {
    console.error("❌ Workflow failed", error.message)
  } else {
    console.log("✅ Client → Shoot workflow works")
  }
}

runTests()