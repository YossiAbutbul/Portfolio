import Hero from "@/components/hero/Hero";
import About from "@/components/about/About";
import FeaturedShowcase from "@/components/showcase/FeaturedShowcase";
import ProjectsGrid from "@/components/projects/ProjectsGrid";
import Experience from "@/components/experience/Experience";
import Stack from "@/components/skills/Stack";
import Contact from "@/components/contact/Contact";

export default function HomePage() {
  return (
    <>
      <Hero />
      <About />
      <FeaturedShowcase />
      <ProjectsGrid />
      <Experience />
      <Stack />
      <Contact />
    </>
  );
}
