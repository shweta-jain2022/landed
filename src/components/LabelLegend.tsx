import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { VerifyBadge } from "@/components/VerifyBadge";

export function LabelLegend() {
  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button type="button" variant="link" className="h-auto whitespace-normal p-0 text-left text-xs">
          What do these labels mean?
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-3 text-sm text-muted-foreground">
        <div>
          <VerifyBadge grounded small />
          <p className="mt-1">Based on curated, fact-checked guidance for this route. See the Sources panel for the date it was last checked.</p>
        </div>
        <div>
          <VerifyBadge grounded={false} small />
          <p className="mt-1">Sensible general guidance that we haven’t verified for this route. Confirm with official sources.</p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}