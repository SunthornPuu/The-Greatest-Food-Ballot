import type { Metadata } from "next";
import { preload } from "react-dom";
import { Booth } from "@/components/booth/Booth";

export const metadata: Metadata = { title: "The Booth · The Greatest Food Ballot" };

export default function VotePage() {
  preload("/ballot.jpg", { as: "image", fetchPriority: "high" });
  return <Booth />;
}
