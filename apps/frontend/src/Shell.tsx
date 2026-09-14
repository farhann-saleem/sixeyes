import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AudioStudio } from "./Audio";
import { App } from "./App";
import { ImagesTemplates } from "./ImagesTemplates";
import { Landing } from "./landing/Landing";
import { Library } from "./Library";
import { McpDesk } from "./Mcp";
import { Footer } from "./Footer";
import { Nav, pathToRoute, routeToPath, routeTitle, type Route } from "./Nav";
import { TemplateStudio } from "./TemplateStudio";
import { VideoTemplates } from "./VideoTemplates";
import { ProjectsHome, ProjectWorkspace } from "./projects/DocumentaryFlow";
import { isLive, json, type Catalog, type SavedAvatar, type SwapJob } from "./studio";
import { fetchUser, googleLogout, type User } from "./auth";
import { AuthBadge, LoginGate } from "./LoginGate";
import { Pricing } from "./Pricing";
import { Policy } from "./Policy";

export function Shell() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [route, setRoute] = useState<Route>(() =>
    typeof window === "undefined"
      ? { name: "landing" }
      : pathToRoute(window.location.pathname, window.location.search),
  );
  const [imageCatalog, setImageCatalog] = useState<Catalog | null>(null);
  const [videoCatalog, setVideoCatalog] = useState<Catalog | null>(null);
  const [effectCatalog, setEffectCatalog] = useState<Catalog | null>(null);
  const [jobs, setJobs] = useState<SwapJob[]>([]);
  const [identities, setIdentities] = useState<SavedAvatar[]>([]);
  const [error, setError] = useState<string | null>(null);
  const live = useMemo(() => jobs.find(isLive) ?? null, [jobs]);
  const liveRef = useRef(false);
  liveRef.current = Boolean(live);

  useEffect(() => {
    fetchUser().then(setUser);
  }, []);

  useEffect(() => {
    const onPop = () => setRoute(pathToRoute(window.location.pathname, window.location.search));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    document.title = routeTitle(route);
  }, [route]);

  const loadCatalogs = useCallback(() => {
    json<Catalog>("/api/image-templates")
      .then(setImageCatalog)
      .catch((err: Error) => setError(err.message));
    json<Catalog>("/api/video-templates")
      .then(setVideoCatalog)
      .catch((err: Error) => setError(err.message));
    json<Catalog>("/api/effects")
      .then(setEffectCatalog)
      .catch((err: Error) => setError(err.message));
  }, []);

  const loadJobs = useCallback(() => {
    json<{ jobs: SwapJob[] }>("/api/faceswaps")
      .then((body) => {
        setJobs(body.jobs);
        setError(null);
      })
      .catch((err: Error) => setError(err.message));
    json<{ identities: SavedAvatar[] }>("/api/identities")
      .then((body) => setIdentities(body.identities))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    loadCatalogs();
    loadJobs();
    const catalogTimer = window.setInterval(loadCatalogs, 30_000);
    return () => window.clearInterval(catalogTimer);
  }, [loadCatalogs, loadJobs]);

  useEffect(() => {
    const id = window.setInterval(() => loadJobs(), live ? 2000 : 12_000);
    return () => window.clearInterval(id);
  }, [live, loadJobs]);

  const go = useCallback((next: Route) => {
    const path = routeToPath(next);
    const here = `${window.location.pathname}${window.location.search}`;
    if (here !== path) window.history.pushState({}, "", path);
    setRoute(next);
    window.scrollTo({ top: 0 });
    loadJobs();
  }, [loadJobs]);

  const onJob = useCallback((job: SwapJob) => {
    setJobs((prev) => [job, ...prev.filter((j) => j.id !== job.id)]);
  }, []);

  const onDelete = useCallback(async (id: string) => {
    await json<{ ok: boolean }>(`/api/faceswaps/${id}`, { method: "DELETE" });
    setJobs((prev) => prev.filter((j) => j.id !== id));
  }, []);

  const onEditInStudio = useCallback(
    async (libraryId: string) => {
      const project = await json<{ id: string }>("/api/studio/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: { type: "library", id: libraryId } }),
      });
      go({ name: "project", id: project.id, step: "studio" });
    },
    [go],
  );

  const libraryCount = useMemo(
    () => jobs.filter((j) => j.status === "COMPLETED").length,
    [jobs],
  );

  const inStudio =
    (route.name === "project" && route.step === "studio") || (route.name === "studio" && Boolean(route.id));
  const hideFooter = route.name === "landing" || inStudio;

  if (user === undefined) {
    return <div className="app-shell"><div className="app-main" /></div>;
  }
  if (!user) {
    return <LoginGate />;
  }

  return (
    <div className={`app-shell${route.name === "landing" ? " is-landing" : ""}${inStudio ? " is-nle" : ""}`}>
      <Nav route={route} onGo={go} libraryCount={libraryCount} auth={<AuthBadge user={user} onLogout={() => void googleLogout()} />} />
      <div className="app-main">
      {route.name === "landing" ? (
        <Landing onGo={go} />
      ) : route.name === "templates" ? (
        <ImagesTemplates
          catalog={imageCatalog}
          jobs={jobs}
          error={error}
          onOpen={(id) => go({ name: "template", id })}
        />
      ) : route.name === "template" ? (
        <TemplateStudio
          templateId={route.id}
          catalog={imageCatalog}
          jobs={jobs}
          identities={identities}
          onJob={onJob}
          onBack={() => go({ name: "templates" })}
          onLibrary={() => go({ name: "library" })}
          onGoAvatar={() => go({ name: "avatar" })}
          onEditInStudio={onEditInStudio}
          mode="image"
        />
      ) : route.name === "videos" ? (
        <VideoTemplates
          catalog={videoCatalog}
          jobs={jobs}
          error={error}
          onOpen={(id) => go({ name: "video", id })}
        />
      ) : route.name === "video" ? (
        <TemplateStudio
          templateId={route.id}
          catalog={videoCatalog}
          jobs={jobs}
          identities={identities}
          onJob={onJob}
          onBack={() => go({ name: "videos" })}
          onLibrary={() => go({ name: "library" })}
          onGoAvatar={() => go({ name: "avatar" })}
          onEditInStudio={onEditInStudio}
          mode="video"
        />
      ) : route.name === "effects" ? (
        <VideoTemplates
          catalog={effectCatalog}
          jobs={jobs}
          error={error}
          onOpen={(id) => go({ name: "effect", id })}
          kicker="Effects"
          title="Generate an effect"
          lede="Each pack is a baked motion. Pick a clip, add a reference still or a saved identity, and we generate that effect."
          emptyHint="Add clips to the effects-template folder and they appear here."
          groupByEffect
        />
      ) : route.name === "effect" ? (
        <TemplateStudio
          templateId={route.id}
          catalog={effectCatalog}
          jobs={jobs}
          identities={identities}
          onJob={onJob}
          onBack={() => go({ name: "effects" })}
          onLibrary={() => go({ name: "library" })}
          onGoAvatar={() => go({ name: "avatar" })}
          onEditInStudio={onEditInStudio}
          mode="video"
        />
      ) : route.name === "library" ? (
        <Library
          imageCatalog={imageCatalog}
          videoCatalog={videoCatalog}
          effectCatalog={effectCatalog}
          jobs={jobs}
          onBrowseImages={() => go({ name: "templates" })}
          onBrowseVideos={() => go({ name: "videos" })}
          onBrowseEffects={() => go({ name: "effects" })}
          onGoAvatar={() => go({ name: "avatar" })}
          onDelete={onDelete}
          onEditInStudio={onEditInStudio}
          onOpenFilm={(id, step) => go({ name: "project", id, step })}
        />
      ) : route.name === "mcp" ? (
        <McpDesk />
      ) : route.name === "pricing" ? (
        <Pricing user={user} />
      ) : route.name === "terms" || route.name === "refund" || route.name === "delivery" || route.name === "cancellation" ? (
        <Policy page={route.name} />
      ) : route.name === "audio" ? (
        <AudioStudio desk={route.desk} />
      ) : route.name === "project" || (route.name === "studio" && route.id) ? (
        <ProjectWorkspace key={route.id} id={route.id!} step={route.name === "project" ? route.step : "studio"}
          onStep={(step) => go({ name: "project", id: route.id!, step })} onHome={() => go({ name: "projects" })} />
      ) : route.name === "projects" || route.name === "studio" ? (
        <ProjectsHome onOpen={(id, step) => go({ name: "project", id, step })} />
      ) : (
        <App key="avatar-page" onIdentities={setIdentities} />
      )}
      </div>
      {hideFooter ? null : <Footer onGo={go} />}
    </div>
  );
}
