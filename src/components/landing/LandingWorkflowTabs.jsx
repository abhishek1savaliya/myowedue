"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { landingMutedSm } from "@/lib/landing-classes";

export default function LandingWorkflowTabs() {
  return (
    <Tabs defaultValue="track" className="mt-10 hidden md:block">
      <TabsList>
        <TabsTrigger value="track">Track</TabsTrigger>
        <TabsTrigger value="remind">Remind</TabsTrigger>
        <TabsTrigger value="report">Report</TabsTrigger>
      </TabsList>
      <TabsContent value="track">
        <p className={landingMutedSm}>Unified ledger for every credit and debit you manage.</p>
      </TabsContent>
      <TabsContent value="remind">
        <p className={landingMutedSm}>Smart schedules that respect timezone and tone.</p>
      </TabsContent>
      <TabsContent value="report">
        <p className={landingMutedSm}>Investor-ready exports in one click.</p>
      </TabsContent>
    </Tabs>
  );
}
