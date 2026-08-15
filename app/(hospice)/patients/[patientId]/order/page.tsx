import { redirect } from "next/navigation";

/**
 * The order flow lives at /order/[patientId] (N8/N9 lane ownership). The patient card
 * has always linked to /patients/[patientId]/order, so this keeps that link — and any
 * bookmark or demo deep link — landing on the flow instead of a 404.
 */
export default async function PatientOrderRedirect({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;
  redirect(`/order/${patientId}?step=items`);
}
