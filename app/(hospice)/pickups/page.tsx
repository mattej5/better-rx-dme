import { redirect } from "next/navigation";

export default function PickupsPage() {
  redirect("/patients?show=pickups");
}
