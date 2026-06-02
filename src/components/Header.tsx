import { BookOpen, Sparkles } from "lucide-react";
import { Button } from "./ui/button";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-blue-500">
            <BookOpen className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight">
              KDP<span className="gradient-text">Intel</span>
            </span>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-6">
          <a
            href="#"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            How It Works
          </a>
          <a
            href="#"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Pricing
          </a>
          <a
            href="#"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Resources
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm">
            Sign In
          </Button>
          <Button variant="premium" size="sm">
            <Sparkles className="w-4 h-4" />
            Start Free
          </Button>
        </div>
      </div>
    </header>
  );
}
