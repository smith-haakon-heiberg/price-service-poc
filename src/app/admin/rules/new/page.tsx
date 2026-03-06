import Link from "next/link";
import CreateRuleForm from "./CreateRuleForm";

export default function NewRulePage() {
  return (
    <div>
      <Link href="/admin/rules" className="text-sm text-muted mb-4 inline-block">
        &larr; Back to Rules
      </Link>
      <h1 className="text-2xl font-bold mb-6">Create Price Rule</h1>
      <CreateRuleForm />
    </div>
  );
}
