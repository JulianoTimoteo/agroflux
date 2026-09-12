import { createFileRoute, redirect } from "@tanstack/react-router";

// O AgroFlux é servido tal como está no GitHub (HTML/CSS/JS + Firebase),
// a partir de /app/index.html. A raiz apenas redireciona para lá.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ href: "/app/index.html" });
  },
  head: () => ({
    meta: [
      { title: "AgroFlux — Gestão de Campo · Usina Pitangueiras" },
      {
        name: "description",
        content:
          "AgroFlux: apontamento e monitoramento de produtividade agrícola em tempo real para os setores responsáveis.",
      },
      { property: "og:title", content: "AgroFlux — Gestão de Campo" },
      {
        property: "og:description",
        content:
          "Apontamento e monitoramento de produtividade agrícola em tempo real.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => null,
});
