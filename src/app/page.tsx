import { FEATURED_PROJECTS } from "@content/projects";
import Hero from "@/components/sections/Hero";
import Work from "@/components/sections/Work";
import AboutTeaser from "@/components/sections/AboutTeaser";
import Experience from "@/components/sections/Experience";
import Contact from "@/components/sections/Contact";
import { findPortrait } from "@/lib/assets";

export default function HomePage() {
  return (
    <>
      <Hero projects={FEATURED_PROJECTS} />
      <Work projects={FEATURED_PROJECTS} />
      <AboutTeaser portrait={findPortrait()} />
      <Experience />
      <Contact />
    </>
  );
}
