import { EvaluationDetail } from "@/features/history/EvaluationDetail";

export const metadata = { title: "Evaluation — BidLens" };

export default async function EvaluationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main>
      <EvaluationDetail id={id} />
    </main>
  );
}
