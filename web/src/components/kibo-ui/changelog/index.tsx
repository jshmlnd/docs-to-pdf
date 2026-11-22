// Kibo UI "Changelog" block (https://www.kibo-ui.com/blocks/changelog), MIT.
// Its registry endpoint was down, so this is the block source from github.com/haydenbleasel/kibo.
import { ArrowUpRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ChangelogEntry = {
  version: string;
  date: string;
  title: string;
  description: string;
  items?: string[];
  image?: string;
  button?: {
    url: string;
    text: string;
  };
};

export interface Changelog1Props {
  className?: string;
  title?: string;
  description?: string;
  entries: ChangelogEntry[];
}

export const Changelog1 = ({
  title = "Changelog",
  description = "Get the latest updates and improvements to our platform.",
  entries,
  className,
}: Changelog1Props) => {
  return (
    <section className={cn("py-32", className)}>
      <div className="container">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-5xl">
            {title}
          </h2>
          <p className="mb-6 text-base text-muted-foreground md:text-lg">
            {description}
          </p>
        </div>
        <div className="mx-auto mt-16 max-w-3xl space-y-16 md:mt-24 md:space-y-24">
          {entries.map((entry) => (
            <div
              key={entry.version}
              className="relative flex flex-col gap-4 md:flex-row md:gap-16"
            >
              <div className="top-8 flex h-min w-64 shrink-0 items-center gap-4 md:sticky">
                <Badge variant="secondary" className="text-xs">
                  {entry.version}
                </Badge>
                <span className="text-xs font-medium text-muted-foreground">
                  {entry.date}
                </span>
              </div>
              <div className="flex flex-col">
                <h3 className="mb-3 text-lg leading-tight font-bold text-foreground/90 md:text-2xl">
                  {entry.title}
                </h3>
                <p className="text-sm text-muted-foreground md:text-base">
                  {entry.description}
                </p>
                {entry.items && entry.items.length > 0 && (
                  <ul className="mt-4 ml-4 space-y-1.5 text-sm text-muted-foreground md:text-base">
                    {entry.items.map((item) => (
                      <li key={item} className="list-disc">
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
                {entry.image && (
                  <img
                    src={entry.image}
                    alt={`${entry.version} visual`}
                    className="mt-8 w-full rounded-lg object-cover"
                  />
                )}
                {entry.button && (
                  <Button variant="link" className="mt-4 self-end" asChild>
                    <a href={entry.button.url} target="_blank" rel="noreferrer">
                      {entry.button.text} <ArrowUpRight className="h-4 w-4" />
                    </a>
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
