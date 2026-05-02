'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import {
  BookOpenCheck,
  MessagesSquare,
  Scale,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/app/providers';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

// Adal Nexus – Pakistan Legal Community Platform
// Phase 1 landing page. This page is intentionally simple; the design team
// will replace it with Figma exports in a later phase.

const features = [
  {
    icon: Scale,
    title: 'Professional Profiles',
    description:
      'Build your legal identity from Year 1 — for Pakistani law students, advocates, and judges.',
  },
  {
    icon: Sparkles,
    title: 'AI Legal Chatbot',
    description:
      'Pakistan-aware mentor "Lex" — guidance on the Constitution of Pakistan, PPC, CrPC, and more.',
  },
  {
    icon: MessagesSquare,
    title: 'Community Forum',
    description:
      'Discuss Pakistani case law, careers, and bar exams across eight focused categories.',
  },
  {
    icon: BookOpenCheck,
    title: 'Student Roadmap',
    description:
      'A milestone-based journey adaptable to 3-year and 5-year LL.B. programmes in Pakistan.',
  },
];

const journey = [
  {
    year: 'Year 1',
    theme: 'Foundation',
    blurb:
      'Constitution of Pakistan basics, legal English, communication, and study skills.',
  },
  {
    year: 'Year 2',
    theme: 'Practical',
    blurb:
      'Moot prep, PPC/CrPC tasks, court visits, and structured legal research.',
  },
  {
    year: 'Year 3',
    theme: 'Specialisation',
    blurb:
      'Internships at chambers, SECP, FBR, or NGOs — and mentorship matching.',
  },
  {
    year: 'Year 4',
    theme: 'Portfolio',
    blurb:
      'Publications, bar-exam prep, and a graduation-ready professional portfolio.',
  },
];


export default function LandingPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (user && !loading) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* ───── Top bar ───── */}
      <header className="border-b border-border">
        <div className="container-prose flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full bg-accent" />
            <span className="font-serif text-lg font-semibold text-primary">
              Adal Nexus
            </span>
          </div>
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-primary">
              Features
            </a>
            <a href="#journey" className="hover:text-primary">
              Roadmap
            </a>
            <a href="#about" className="hover:text-primary">
              About
            </a>
          </nav>
          <Button size="sm" variant="accent" onClick={() => router.push('/auth/signin')}>
            Sign in
          </Button>
        </div>
      </header>

      {/* ───── Hero ───── */}
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            background:
              'radial-gradient(ellipse at top right, #D4AF37 0%, transparent 60%)',
          }}
        />
        <div className="container-prose relative py-20 sm:py-28">
          <p className="mb-4 text-sm uppercase tracking-[0.2em] text-accent">
            Pakistan Edition
          </p>
          <h1 className="max-w-3xl font-serif text-4xl leading-tight sm:text-5xl md:text-6xl">
            Adal Nexus —{' '}
            <span className="text-accent">Pakistan&apos;s Legal</span>{' '}
            Community Platform.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-primary-foreground/80">
            Connect, learn, and grow with fellow legal professionals across
            Pakistan. Built for law students, advocates, and judges — from the
            Supreme Court to the district bar.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button variant="accent" size="lg" onClick={() => router.push('/auth/signup')}>
              Join as Student
            </Button>
            <Button variant="accent" size="lg" onClick={() => router.push('/auth/signup')}>
              Join as Lawyer
            </Button>
            <Button variant="outline" size="lg" className="border-accent/40 text-accent hover:bg-accent/10" onClick={() => router.push('/auth/signin')}>
              Explore Community
            </Button>
          </div>
        </div>
      </section>

      {/* ───── Features ───── */}
      <section id="features" className="py-20">
        <div className="container-prose">
          <h2 className="text-3xl text-primary sm:text-4xl">
            Built for the Pakistani legal community
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Four pillars that take a law student from their first lecture to
            their first brief — and give practising advocates a place to teach,
            learn, and connect.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, description }) => (
              <Card key={title}>
                <CardHeader>
                  <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-md bg-accent/10 text-accent">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle>{title}</CardTitle>
                  <CardDescription>{description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ───── Legal Journey preview ───── */}
      <section id="journey" className="bg-muted py-20">
        <div className="container-prose">
          <h2 className="text-3xl text-primary sm:text-4xl">
            The Legal Journey
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            A milestone-based framework that adapts to <strong>3-year</strong>{' '}
            and <strong>5-year</strong> LL.B. programmes. Progress is measured
            by completed milestones, not calendar years.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {journey.map(({ year, theme, blurb }) => (
              <Card key={year}>
                <CardContent className="p-6">
                  <p className="text-xs uppercase tracking-[0.18em] text-accent">
                    {year}
                  </p>
                  <h3 className="mt-2 font-serif text-xl text-primary">
                    {theme}
                  </h3>
                  <p className="mt-3 text-sm text-muted-foreground">{blurb}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ───── About ───── */}
      <section id="about" className="py-20">
        <div className="container-prose grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <h2 className="text-3xl text-primary sm:text-4xl">
              Bridging legal education and practice — in Pakistan.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Adal Nexus is free and open to the legal community across all
              provinces, AJK, GB, and Islamabad. Graduate with a network, an
              identity, and a track record — not just a degree.
            </p>
          </div>
          <Card>
            <CardContent className="p-8">
              <p className="font-serif text-2xl text-primary">
                &ldquo;Where the Legal Community Connects, Learns &amp; Grows.&rdquo;
              </p>
              <p className="mt-4 text-sm text-muted-foreground">
                — A platform for the Pakistani bar, bench, and the next
                generation of legal professionals.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ───── Footer ───── */}
      <footer className="border-t border-border bg-primary text-primary-foreground">
        <div className="container-prose flex flex-col items-start gap-6 py-10 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-serif text-lg">Adal Nexus</p>
            <p className="mt-1 text-sm text-primary-foreground/70">
              &copy; {new Date().getFullYear()} Adal Nexus. Pakistan Edition.
            </p>
          </div>
          <nav className="flex flex-wrap gap-6 text-sm text-primary-foreground/80">
            <a href="mailto:hello@adalnexus.com.pk" className="hover:text-accent">
              hello@adalnexus.com.pk
            </a>
            <a href="#" className="hover:text-accent">
              Privacy
            </a>
            <a href="#" className="hover:text-accent">
              Terms
            </a>
          </nav>
        </div>
      </footer>
    </main>
  );
}
