import type { Metadata } from "next";
import { Suspense } from "react";
import { BallotWall } from "@/components/log/BallotWall";

export const metadata: Metadata = { title: "The Ballot Box · The Greatest Food Ballot" };

export default function LogPage() {
  return (
    <Suspense>
      <BallotWall />
    </Suspense>
  );
}
