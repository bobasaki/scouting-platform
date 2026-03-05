import Link from "next/link";
import { APP_TITLE } from "../lib/shell";

export default function HomePage() {
  return (
    <main className="bootstrap-home">
      <h1>{APP_TITLE}</h1>
      <p>Week 0 scaffold is ready.</p>
      <p>
        Open <Link href="/catalog">the authenticated shell placeholder</Link>.
      </p>
    </main>
  );
}
