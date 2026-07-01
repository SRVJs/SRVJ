<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useHead } from "@unhead/vue";
import { useRouter } from "vue-router";
import AuthDialog from "@/components/AuthDialog.vue";
import NavBar from "@/components/navBar.vue";
import { useSeo } from "@/composables/useSeo";
import { useAuthStore } from "@/stores/auth";
import { useGoogleAuth } from "@/composables/useGoogleAuth";
import { SITE_DESCRIPTION } from "@/utils/constants";

useSeo({ title: "SRVJ | Free Online Diagram Editor & Whiteboard", path: "/" });

// Marketing typefaces from the design (loaded into <head>, SSG-safe).
useHead({
  link: [
    { rel: "preconnect", href: "https://fonts.googleapis.com" },
    { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" },
    {
      rel: "stylesheet",
      href:
        "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap",
    },
  ],
});

const root = ref<HTMLElement | null>(null);
const authOpen = ref(false);

const auth = useAuthStore();
const google = useGoogleAuth();
const router = useRouter();

async function autoPromptGoogle() {
  if (!google.isConfigured || auth.isAuthenticated) return;
  try {
    await google.init(async (credential) => {
      try {
        await auth.loginWithGoogleCredential(credential);
        await router.push({ name: "dashboard" });
      } catch {
        // Credential rejected — surface via auth.error; fall back to dialog.
        authOpen.value = true;
      }
    });
    google.prompt();
  } catch {
    // GIS unavailable or blocked; the page stays usable without One Tap.
  }
}

// ---- Features ----------------------------------------------------------
const features = [
  {
    icon: "i-carbon-flow",
    tint: "rgba(99,102,241,.1)",
    color: "#6366f1",
    title: "Flowcharts & diagrams",
    body:
      "A Draw.io-style editor with shapes, smart connectors, and crow’s-foot ERD tables.",
  },
  {
    icon: "i-mdi-draw",
    tint: "rgba(244,114,182,.12)",
    color: "#ec4899",
    title: "Hand-drawn sketch mode",
    body:
      "Toggle an Excalidraw-style rough look for whiteboard-flavoured diagrams in one click.",
  },
  {
    icon: "i-mdi-sticky-note-outline",
    tint: "rgba(245,158,11,.14)",
    color: "#f59e0b",
    title: "Sticky notes & text",
    body:
      "Miro-style sticky notes and free text, with colour, fill, stroke, and opacity controls.",
  },
  {
    icon: "i-mdi-folder-multiple-outline",
    tint: "rgba(34,211,238,.14)",
    color: "#06b6d4",
    title: "Projects & diagrams",
    body: "Organise your work into projects, each holding the diagrams you need.",
  },
  {
    icon: "i-mdi-cloud-check-outline",
    tint: "rgba(34,197,94,.14)",
    color: "#22c55e",
    title: "Saved to your account",
    body:
      "Sign in to keep projects in sync across your devices, backed up automatically.",
  },
  {
    icon: "i-mdi-share-variant-outline",
    tint: "rgba(99,102,241,.1)",
    color: "#6366f1",
    title: "Share a link",
    body: "Hand a teammate a room link and collaborate on the same canvas together.",
  },
];

// ---- Use cases (interactive tabs) -------------------------------------
const useCases = [
  {
    tab: "Flowcharts",
    title: "Map any process, end to end",
    desc:
      "Drop shapes, snap smart connectors between them, and let the layout stay tidy as it grows. Decision diamonds, swimlanes and crow’s-foot ERD tables included.",
    label: "Start → Decide → Ship",
    gradient: "linear-gradient(135deg,#6366f1,#818cf8)",
    color: "#fff",
  },
  {
    tab: "Whiteboarding",
    title: "Think out loud, together",
    desc:
      "Toss sticky notes onto an infinite canvas, cluster ideas, and switch on hand-drawn mode when a session should feel loose and human.",
    label: "Brainstorm freely",
    gradient: "linear-gradient(135deg,#f59e0b,#fbbf24)",
    color: "#3b2606",
  },
  {
    tab: "ERD & databases",
    title: "Design schemas that read clearly",
    desc:
      "Crow’s-foot notation, typed columns, and relationship lines that stay attached. Sketch the data model before you write a migration.",
    label: "users —⟨ orders",
    gradient: "linear-gradient(135deg,#06b6d4,#22d3ee)",
    color: "#04313a",
  },
  {
    tab: "Mind maps",
    title: "Branch ideas without limits",
    desc:
      "Start from one node and let thoughts radiate outward. Colour-code branches, add notes, and rearrange the whole map in seconds.",
    label: "One idea, many branches",
    gradient: "linear-gradient(135deg,#22c55e,#4ade80)",
    color: "#06310f",
  },
];
const activeUseCase = ref(0);
const current = computed(() => useCases[activeUseCase.value]);

const year = new Date().getFullYear();

// ---- Reveal-on-scroll --------------------------------------------------
let io: IntersectionObserver | undefined;

onMounted(() => {
  void autoPromptGoogle();
  const els = root.value
    ? Array.from(root.value.querySelectorAll<HTMLElement>(".reveal"))
    : [];
  if (!("IntersectionObserver" in window)) {
    els.forEach((el) => el.classList.add("is-visible"));
    return;
  }
  io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("is-visible");
          io?.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
  );
  els.forEach((el) => io!.observe(el));
});

onBeforeUnmount(() => {
  io?.disconnect();
  google.cancel();
});
</script>

<template>
  <div ref="root" class="lp" style="overflow-x: hidden; background: #0a0a0f">
    <!-- ============ NAV ============ -->
    <NavBar variant="landing" @auth="authOpen = true" />

    <!-- ============ HERO ============ -->
    <section
      id="top"
      style="
        position: relative;
        background: #0a0a0f;
        color: #ececf1;
        padding: 150px 24px 80px;
        overflow: hidden;
      "
    >
      <div
        style="
          position: absolute;
          top: -160px;
          left: 50%;
          transform: translateX(-50%);
          width: 900px;
          height: 600px;
          background: radial-gradient(
            50% 50% at 50% 50%,
            rgba(99, 102, 241, 0.32),
            rgba(99, 102, 241, 0) 70%
          );
          pointer-events: none;
        "
      ></div>
      <div
        style="
          position: absolute;
          inset: 0;
          background-image: radial-gradient(
            rgba(255, 255, 255, 0.05) 1px,
            transparent 1px
          );
          background-size: 26px 26px;
          -webkit-mask-image: radial-gradient(
            70% 60% at 50% 30%,
            #000 30%,
            transparent 80%
          );
          mask-image: radial-gradient(70% 60% at 50% 30%, #000 30%, transparent 80%);
          pointer-events: none;
        "
      ></div>

      <div
        style="position: relative; max-width: 880px; margin: 0 auto; text-align: center"
      >
        <div
          style="
            display: inline-flex;
            align-items: center;
            gap: 9px;
            padding: 7px 14px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.12);
            font-size: 13px;
            font-weight: 500;
            color: #c7c7d1;
            margin-bottom: 28px;
          "
        >
          <span
            style="
              width: 7px;
              height: 7px;
              border-radius: 50%;
              background: #818cf8;
              box-shadow: 0 0 10px #818cf8;
            "
          ></span>
          Free forever · Works offline
        </div>
        <h1
          class="lp-display"
          style="
            font-weight: 700;
            font-size: clamp(40px, 6.5vw, 76px);
            line-height: 1.02;
            letter-spacing: -0.03em;
            margin: 0 0 24px;
          "
        >
          SRVJ is the diagram editor<br />that works the way
          <span
            style="
              background: linear-gradient(110deg, #818cf8, #c4b5fd);
              -webkit-background-clip: text;
              background-clip: text;
              color: transparent;
            "
            >you think</span
          >
        </h1>
        <p
          style="
            font-size: clamp(16px, 2vw, 20px);
            line-height: 1.55;
            color: #a3a3b0;
            max-width: 600px;
            margin: 0 auto 38px;
          "
        >
          {{ SITE_DESCRIPTION }}
        </p>
        <div
          style="
            display: flex;
            gap: 14px;
            justify-content: center;
            flex-wrap: wrap;
            margin-bottom: 18px;
          "
        >
          <button
            type="button"
            class="lp-btn lp-btn--primary lp-btn--lg"
            @click="authOpen = true"
          >
            Get started
          </button>
          <RouterLink to="/app/demo" class="lp-btn lp-btn--ghost lp-btn--lg"
            >Try demo</RouterLink
          >
        </div>
        <p style="font-size: 13px; color: #6b6b7a">
          No credit card. No download. Just open and go.
        </p>
      </div>

      <!-- canvas preview window -->
      <div
        class="reveal lp-hero-preview"
        style="position: relative; max-width: 1000px; margin: 64px auto 0"
      >
        <div
          style="
            border-radius: 18px;
            background: #14141c;
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 40px 90px rgba(0, 0, 0, 0.6);
            overflow: hidden;
            animation: srvj-tilt 9s ease-in-out infinite;
          "
        >
          <!-- toolbar -->
          <div
            style="
              display: flex;
              align-items: center;
              gap: 8px;
              padding: 13px 16px;
              border-bottom: 1px solid rgba(255, 255, 255, 0.07);
              background: #16161f;
            "
          >
            <span
              style="width: 11px; height: 11px; border-radius: 50%; background: #ff5f57"
            ></span>
            <span
              style="width: 11px; height: 11px; border-radius: 50%; background: #febc2e"
            ></span>
            <span
              style="width: 11px; height: 11px; border-radius: 50%; background: #28c840"
            ></span>
            <!-- mock tool icons -->
            <div style="display: flex; gap: 6px; margin-left: 18px">
              <span
                style="
                  width: 26px;
                  height: 26px;
                  border-radius: 7px;
                  background: rgba(99, 102, 241, 0.25);
                  border: 1px solid rgba(99, 102, 241, 0.5);
                  display: inline-flex;
                  align-items: center;
                  justify-content: center;
                "
              >
                <span
                  style="
                    width: 9px;
                    height: 9px;
                    border: 2px solid #a5b4fc;
                    border-radius: 2px;
                  "
                ></span>
              </span>
              <span
                style="
                  width: 26px;
                  height: 26px;
                  border-radius: 7px;
                  background: rgba(255, 255, 255, 0.05);
                  display: inline-flex;
                  align-items: center;
                  justify-content: center;
                "
              >
                <span
                  style="
                    width: 11px;
                    height: 11px;
                    border: 2px solid #8a8a99;
                    border-radius: 50%;
                  "
                ></span>
              </span>
              <span
                style="
                  width: 26px;
                  height: 26px;
                  border-radius: 7px;
                  background: rgba(255, 255, 255, 0.05);
                  display: inline-flex;
                  align-items: center;
                  justify-content: center;
                "
              >
                <span
                  style="
                    width: 9px;
                    height: 9px;
                    border: 2px solid #8a8a99;
                    transform: rotate(45deg);
                  "
                ></span>
              </span>
              <span
                style="
                  width: 26px;
                  height: 26px;
                  border-radius: 7px;
                  background: rgba(255, 255, 255, 0.05);
                  display: inline-flex;
                  align-items: center;
                  justify-content: center;
                "
              >
                <span style="width: 13px; height: 2px; background: #8a8a99"></span>
              </span>
              <span
                style="
                  width: 26px;
                  height: 26px;
                  border-radius: 7px;
                  background: rgba(255, 255, 255, 0.05);
                  display: inline-flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 12px;
                  font-weight: 700;
                  color: #8a8a99;
                "
                >T</span
              >
            </div>
            <div style="margin-left: auto; display: flex; align-items: center; gap: 8px">
              <span
                style="
                  width: 24px;
                  height: 24px;
                  border-radius: 50%;
                  background: linear-gradient(135deg, #f472b6, #c4b5fd);
                  border: 2px solid #14141c;
                "
              ></span>
              <span
                style="
                  width: 24px;
                  height: 24px;
                  border-radius: 50%;
                  background: linear-gradient(135deg, #34d399, #22d3ee);
                  border: 2px solid #14141c;
                  margin-left: -10px;
                "
              ></span>
              <span
                style="
                  font-size: 12px;
                  font-weight: 600;
                  color: #6366f1;
                  background: rgba(99, 102, 241, 0.15);
                  padding: 5px 11px;
                  border-radius: 7px;
                  margin-left: 6px;
                "
                >Share</span
              >
            </div>
          </div>
          <!-- canvas -->
          <div
            style="
              position: relative;
              height: 440px;
              background: #0f0f16;
              background-image: radial-gradient(
                rgba(255, 255, 255, 0.06) 1px,
                transparent 1px
              );
              background-size: 22px 22px;
              overflow: hidden;
            "
          >
            <svg
              viewBox="0 0 1000 440"
              preserveAspectRatio="none"
              style="position: absolute; inset: 0; width: 100%; height: 100%"
            >
              <path
                d="M 175 120 C 280 120, 320 175, 420 195"
                fill="none"
                stroke="#6366f1"
                stroke-width="2.5"
                stroke-dasharray="260"
                stroke-dashoffset="260"
                style="animation: srvj-draw 1.1s ease 0.3s forwards"
              />
              <path
                d="M 560 205 C 660 215, 700 150, 770 135"
                fill="none"
                stroke="#6366f1"
                stroke-width="2.5"
                stroke-dasharray="260"
                stroke-dashoffset="260"
                style="animation: srvj-draw 1.1s ease 0.8s forwards"
              />
              <path
                d="M 490 250 C 490 320, 500 330, 500 360"
                fill="none"
                stroke="#818cf8"
                stroke-width="2.5"
                stroke-dasharray="140"
                stroke-dashoffset="140"
                style="animation: srvj-draw 1s ease 1.3s forwards"
              />
            </svg>
            <div
              style="
                position: absolute;
                left: 10%;
                top: 20%;
                padding: 13px 20px;
                border-radius: 12px;
                background: rgba(52, 211, 153, 0.14);
                border: 1.5px solid #34d399;
                color: #6ee7b7;
                font-size: 14px;
                font-weight: 600;
                animation: srvj-pop 0.5s ease both;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
              "
            >
              Idea
            </div>
            <div
              style="
                position: absolute;
                left: 43%;
                top: 32%;
                width: 120px;
                height: 90px;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: srvj-pop 0.5s ease 0.25s both;
              "
            >
              <div
                style="
                  position: absolute;
                  inset: 0;
                  background: rgba(99, 102, 241, 0.15);
                  border: 1.5px solid #6366f1;
                  transform: rotate(45deg);
                  border-radius: 12px;
                "
              ></div>
              <span
                style="
                  position: relative;
                  font-size: 13px;
                  font-weight: 600;
                  color: #a5b4fc;
                "
                >Viable?</span
              >
            </div>
            <div
              style="
                position: absolute;
                left: 77%;
                top: 22%;
                padding: 13px 20px;
                border-radius: 12px;
                background: rgba(255, 255, 255, 0.06);
                border: 1.5px solid rgba(255, 255, 255, 0.2);
                color: #d4d4dd;
                font-size: 14px;
                font-weight: 600;
                animation: srvj-pop 0.5s ease 0.5s both;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
              "
            >
              Build it
            </div>
            <div
              style="
                position: absolute;
                left: 44%;
                top: 78%;
                padding: 13px 22px;
                border-radius: 12px;
                background: #6366f1;
                color: #fff;
                font-size: 14px;
                font-weight: 600;
                animation: srvj-pop 0.5s ease 1.1s both;
                box-shadow: 0 10px 30px rgba(99, 102, 241, 0.5);
              "
            >
              Ship 🚀
            </div>
            <div
              style="
                position: absolute;
                left: 9%;
                top: 58%;
                width: 130px;
                padding: 14px;
                background: #fde68a;
                color: #713f12;
                border-radius: 4px;
                font-size: 13px;
                font-weight: 500;
                line-height: 1.35;
                box-shadow: 0 12px 28px rgba(0, 0, 0, 0.4);
                animation: srvj-floaty 5s ease-in-out infinite;
                animation-delay: 0.2s;
              "
            >
              Don’t forget the demo!
            </div>
            <div
              style="
                position: absolute;
                left: 79%;
                top: 60%;
                width: 120px;
                padding: 14px;
                background: #fbcfe8;
                color: #831843;
                border-radius: 4px;
                font-size: 13px;
                font-weight: 500;
                line-height: 1.35;
                box-shadow: 0 12px 28px rgba(0, 0, 0, 0.4);
                animation: srvj-floaty2 6s ease-in-out infinite;
              "
            >
              + pricing page
            </div>

            <!-- live collaborator cursors drifting across the canvas -->
            <div
              style="
                position: absolute;
                left: 30%;
                top: 35%;
                animation: srvj-curA 11s ease-in-out infinite;
              "
            >
              <svg width="20" height="20" viewBox="0 0 20 20">
                <path
                  d="M2 2 L2 16 L6 12 L9 18 L11 17 L8 11 L14 11 Z"
                  fill="#f472b6"
                  stroke="#fff"
                  stroke-width="1"
                />
              </svg>
              <span
                style="
                  display: inline-block;
                  margin-left: 12px;
                  margin-top: -4px;
                  background: #f472b6;
                  color: #fff;
                  font-size: 11px;
                  font-weight: 600;
                  padding: 3px 8px;
                  border-radius: 6px;
                "
                >Sara</span
              >
            </div>
            <div
              style="
                position: absolute;
                left: 62%;
                top: 60%;
                animation: srvj-curB 9s ease-in-out infinite;
              "
            >
              <svg width="20" height="20" viewBox="0 0 20 20">
                <path
                  d="M2 2 L2 16 L6 12 L9 18 L11 17 L8 11 L14 11 Z"
                  fill="#34d399"
                  stroke="#fff"
                  stroke-width="1"
                />
              </svg>
              <span
                style="
                  display: inline-block;
                  margin-left: 12px;
                  margin-top: -4px;
                  background: #34d399;
                  color: #062e1f;
                  font-size: 11px;
                  font-weight: 600;
                  padding: 3px 8px;
                  border-radius: 6px;
                "
                >Omar</span
              >
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ============ FEATURES ============ -->
    <section
      id="features"
      class="lp-dots"
      style="background: #ffffff; padding: 110px 24px; scroll-margin-top: 80px"
    >
      <div style="max-width: 1180px; margin: 0 auto">
        <div class="reveal" style="max-width: 640px">
          <span
            style="
              display: inline-block;
              font-size: 13px;
              font-weight: 600;
              letter-spacing: 0.1em;
              text-transform: uppercase;
              color: #6366f1;
              margin-bottom: 16px;
            "
            >Everything in one canvas</span
          >
          <h2
            class="lp-display"
            style="
              font-weight: 700;
              font-size: clamp(30px, 4vw, 46px);
              line-height: 1.08;
              letter-spacing: -0.02em;
              margin: 0 0 16px;
              color: #16161d;
            "
          >
            Six tools that feel like one
          </h2>
          <p style="font-size: 18px; line-height: 1.55; color: #6b6b76; margin: 0">
            Flowcharts, sketches, sticky notes and tables live side by side. No switching
            apps, no exporting between them.
          </p>
        </div>

        <div
          style="
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-top: 56px;
          "
        >
          <div
            v-for="f in features"
            :key="f.title"
            class="reveal lp-card"
            style="
              padding: 30px;
              border-radius: 18px;
              background: #fafafa;
              border: 1px solid #ededf0;
            "
          >
            <div
              :style="{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: f.tint,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px',
              }"
            >
              <span
                :class="f.icon"
                :style="{ color: f.color, fontSize: '22px' }"
                aria-hidden="true"
              />
            </div>
            <h3
              class="lp-display"
              style="font-weight: 600; font-size: 19px; margin: 0 0 8px; color: #16161d"
            >
              {{ f.title }}
            </h3>
            <p style="font-size: 15px; line-height: 1.55; color: #6b6b76; margin: 0">
              {{ f.body }}
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- ============ USE CASES ============ -->
    <section
      id="usecases"
      class="lp-dots"
      style="background: #f7f7f9; padding: 110px 24px; scroll-margin-top: 80px"
    >
      <div style="max-width: 1180px; margin: 0 auto">
        <div
          class="reveal"
          style="text-align: center; max-width: 640px; margin: 0 auto 48px"
        >
          <span
            style="
              display: inline-block;
              font-size: 13px;
              font-weight: 600;
              letter-spacing: 0.1em;
              text-transform: uppercase;
              color: #6366f1;
              margin-bottom: 16px;
            "
            >Made for the way you work</span
          >
          <h2
            class="lp-display"
            style="
              font-weight: 700;
              font-size: clamp(30px, 4vw, 46px);
              line-height: 1.08;
              letter-spacing: -0.02em;
              margin: 0;
              color: #16161d;
            "
          >
            One canvas, endless uses
          </h2>
        </div>

        <div class="reveal">
          <div
            style="
              display: flex;
              gap: 10px;
              justify-content: center;
              flex-wrap: wrap;
              margin-bottom: 36px;
            "
          >
            <button
              v-for="(uc, i) in useCases"
              :key="uc.tab"
              type="button"
              class="lp-uc-tab"
              :class="{ 'is-active': i === activeUseCase }"
              @click="activeUseCase = i"
            >
              {{ uc.tab }}
            </button>
          </div>

          <div
            class="lp-uc-panel"
            style="
              display: grid;
              grid-template-columns: 1fr 1.15fr;
              background: #fff;
              border: 1px solid #ededf0;
              border-radius: 20px;
              overflow: hidden;
              box-shadow: 0 20px 50px rgba(20, 20, 30, 0.06);
            "
          >
            <div
              class="lp-uc-left"
              style="
                padding: 52px 44px;
                display: flex;
                flex-direction: column;
                justify-content: center;
              "
            >
              <div
                style="
                  display: inline-flex;
                  align-items: center;
                  gap: 8px;
                  font-size: 13px;
                  font-weight: 600;
                  color: #6366f1;
                  margin-bottom: 16px;
                "
              >
                <span
                  style="width: 7px; height: 7px; border-radius: 50%; background: #6366f1"
                ></span
                >{{ current.tab }}
              </div>
              <h3
                class="lp-display"
                style="
                  font-weight: 700;
                  font-size: 30px;
                  line-height: 1.12;
                  letter-spacing: -0.015em;
                  margin: 0 0 14px;
                  color: #16161d;
                "
              >
                {{ current.title }}
              </h3>
              <p
                style="
                  font-size: 16.5px;
                  line-height: 1.6;
                  color: #6b6b76;
                  margin: 0 0 26px;
                "
              >
                {{ current.desc }}
              </p>
              <button type="button" class="lp-tryit" @click="authOpen = true">
                Try it now <span style="font-size: 17px">→</span>
              </button>
            </div>
            <div
              class="lp-uc-right"
              style="
                position: relative;
                min-height: 380px;
                background: #0f0f16;
                background-image: radial-gradient(
                  rgba(255, 255, 255, 0.07) 1px,
                  transparent 1px
                );
                background-size: 20px 20px;
                display: flex;
                align-items: center;
                justify-content: center;
              "
            >
              <div
                class="lp-display"
                :style="{
                  fontWeight: 700,
                  fontSize: '26px',
                  color: current.color,
                  padding: '22px 30px',
                  borderRadius: '14px',
                  textAlign: 'center',
                  boxShadow: '0 16px 40px rgba(0,0,0,.4)',
                  background: current.gradient,
                }"
              >
                {{ current.label }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ============ CTA ============ -->
    <section class="lp-dots" style="background: #ffffff; padding: 90px 24px">
      <div
        class="reveal lp-cta"
        style="
          max-width: 1100px;
          margin: 0 auto;
          position: relative;
          border-radius: 28px;
          background: linear-gradient(135deg, #4f46e5, #6366f1 55%, #818cf8);
          padding: 72px 40px;
          text-align: center;
          overflow: hidden;
        "
      >
        <div
          style="
            position: absolute;
            inset: 0;
            background-image: radial-gradient(
              rgba(255, 255, 255, 0.12) 1px,
              transparent 1px
            );
            background-size: 24px 24px;
            pointer-events: none;
          "
        ></div>
        <div style="position: relative">
          <h2
            class="lp-display"
            style="
              font-weight: 700;
              font-size: clamp(30px, 4.5vw, 50px);
              line-height: 1.05;
              letter-spacing: -0.02em;
              margin: 0 0 16px;
              color: #fff;
            "
          >
            Open the canvas. Start thinking.
          </h2>
          <p
            style="
              font-size: 18px;
              color: rgba(255, 255, 255, 0.85);
              margin: 0 auto 32px;
              max-width: 480px;
            "
          >
            No limits. Your next diagram is one click away.
          </p>
          <button
            type="button"
            class="lp-btn lp-btn--white lp-btn--lg"
            @click="authOpen = true"
          >
            Get started — it’s free
          </button>
        </div>
      </div>
    </section>

    <!-- ============ FOOTER ============ -->
    <footer class="lp-footer lp-dots-on-dark" style="background: #0a0a0f; color: #c7c7d1; padding: 70px 24px 40px">
      <div style="max-width: 1180px; margin: 0 auto">
        <div
          style="
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 40px;
            padding-bottom: 50px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          "
        >
          <div>
            <a
              href="#top"
              style="
                display: flex;
                align-items: center;
                gap: 10px;
                text-decoration: none;
                margin-bottom: 16px;
              "
            >
              <img
                src="/logo-mark.png"
                alt="SRVJ"
                width="46"
                height="38"
                style="height: 38px; width: 46px; border-radius: 9px"
              />
            </a>
            <p
              style="
                font-size: 14px;
                line-height: 1.6;
                color: #8a8a99;
                max-width: 280px;
                margin: 0;
              "
            >
              The free, browser-based diagram editor and whiteboard.
            </p>
          </div>
          <div>
            <p
              style="font-size: 13px; font-weight: 700; color: #f4f4f7; margin: 0 0 16px"
            >
              Product
            </p>
            <div style="display: flex; flex-direction: column; gap: 11px">
              <a href="#features" class="lp-footlink">Features</a>
              <a href="#usecases" class="lp-footlink">Use cases</a>
            </div>
          </div>
          <div>
            <p
              style="font-size: 13px; font-weight: 700; color: #f4f4f7; margin: 0 0 16px"
            >
              Account
            </p>
            <div style="display: flex; flex-direction: column; gap: 11px">
              <button
                type="button"
                class="lp-footlink"
                style="background: none; border: 0; text-align: left; cursor: pointer"
                @click="authOpen = true"
              >
                Sign in
              </button>
              <button
                type="button"
                class="lp-footlink"
                style="background: none; border: 0; text-align: left; cursor: pointer"
                @click="authOpen = true"
              >
                Get started
              </button>
            </div>
          </div>
        </div>
        <div
          style="
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 16px;
            padding-top: 26px;
          "
        >
          <p style="font-size: 13px; color: #6b6b7a; margin: 0">
            © {{ year }} SRVJ — Free online diagram editor & whiteboard. By elrefai.
          </p>
          <p style="font-size: 13px; color: #6b6b7a; margin: 0">
            Built for people who think out loud.
          </p>
        </div>
      </div>
    </footer>

    <AuthDialog :open="authOpen" @close="authOpen = false" />
  </div>
</template>

<style scoped>
.lp {
  font-family: "Plus Jakarta Sans", system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
}
.lp-display {
  font-family: "Space Grotesk", "Plus Jakarta Sans", sans-serif;
}

.lp-footlink {
  font-size: 14px;
  color: #8a8a99;
  text-decoration: none;
  transition: color 0.2s;
  padding: 0;
}
.lp-footlink:hover {
  color: #fff;
}

/* Buttons */
.lp-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  text-decoration: none;
  border: 0;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.25s ease, background 0.2s ease;
}
.lp-btn--sm {
  font-size: 14.5px;
  padding: 9px 18px;
  border-radius: 10px;
}
.lp-btn--lg {
  font-size: 16px;
  padding: 15px 30px;
  border-radius: 13px;
}
.lp-btn--primary {
  color: #fff;
  background: #6366f1;
  box-shadow: 0 6px 18px rgba(99, 102, 241, 0.4);
}
.lp-btn--primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 34px rgba(99, 102, 241, 0.6);
}
.lp-btn--ghost {
  color: #ececf1;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.16);
}
.lp-btn--ghost:hover {
  background: rgba(255, 255, 255, 0.13);
  transform: translateY(-2px);
}
.lp-btn--white {
  color: #4f46e5;
  background: #fff;
  box-shadow: 0 12px 34px rgba(0, 0, 0, 0.25);
}
.lp-btn--white:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.35);
}

/* Feature cards */
.lp-card {
  transition: opacity 0.6s ease, transform 0.25s ease, box-shadow 0.25s ease,
    border-color 0.25s ease;
}
.lp-card.is-visible:hover {
  transform: translateY(-4px);
  box-shadow: 0 18px 40px rgba(20, 20, 30, 0.08);
  border-color: #d8d8e8;
}

/* Use-case tabs */
.lp-uc-tab {
  font-size: 14.5px;
  font-weight: 600;
  padding: 11px 20px;
  border-radius: 11px;
  border: 1px solid #e3e3ea;
  background: #fff;
  color: #6b6b76;
  cursor: pointer;
  transition: all 0.2s ease;
}
.lp-uc-tab:hover {
  border-color: #c7c7d8;
  color: #16161d;
}
.lp-uc-tab.is-active {
  border-color: #6366f1;
  background: #6366f1;
  color: #fff;
}
.lp-tryit {
  align-self: flex-start;
  font-size: 15px;
  font-weight: 600;
  color: #6366f1;
  background: none;
  border: 0;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 0;
  transition: gap 0.2s;
}
.lp-tryit:hover {
  gap: 12px;
}

/* Reveal-on-scroll */
.reveal {
  opacity: 0;
  transform: translateY(28px);
  transition: opacity 0.7s ease, transform 0.7s ease;
}
.reveal.is-visible {
  opacity: 1;
  transform: none;
}

/* Dotted texture layered over a section's background colour (the hero + CTA
   card carry their own). `!important` beats the inline `background:` shorthand,
   which otherwise resets background-image to none. */
.lp-dots {
  background-image: radial-gradient(rgba(15, 23, 42, 0.06) 1px, transparent 1px) !important;
  background-size: 24px 24px !important;
}
.lp-dots-on-dark {
  background-image: radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px) !important;
  background-size: 24px 24px !important;
}

/* ------------------------------------------------------------ Mobile view ---
   The marketing layout is desktop-tuned with inline styles, so phone overrides
   live here and use `!important` to win over the inline padding/margins.
   `clamp()` headings + `auto-fit` grids already scale; this mainly trims the
   generous vertical rhythm and the roomy use-case panel so it reads on a phone. */
@media (max-width: 768px) {
  /* Section spacing — desktop uses 110–150px which wastes the fold on mobile. */
  #top {
    padding-top: 116px !important;
    padding-bottom: 56px !important;
  }
  #features,
  #usecases {
    padding-top: 64px !important;
    padding-bottom: 64px !important;
  }
  /* The mock-editor preview's floating nodes use fixed px sizes with percentage
     positions tuned for a ~1000px canvas, so they overlap badly on a phone.
     Hide the decorative preview here — the headline + CTAs carry the hero. */
  .lp-hero-preview {
    display: none !important;
  }

  /* Stack the use-case panel and shrink its roomy inner padding. */
  .lp-uc-panel {
    grid-template-columns: 1fr !important;
  }
  .lp-uc-left {
    padding: 36px 24px !important;
  }
  .lp-uc-right {
    min-height: 220px !important;
  }

  .lp-cta {
    padding: 56px 24px !important;
  }
  .lp-footer {
    padding: 56px 22px 36px !important;
  }
}

@media (max-width: 480px) {
  #top {
    padding-top: 104px !important;
  }
  .lp-uc-left {
    padding: 30px 20px !important;
  }
}
</style>

<!-- NON-scoped: `<style scoped>` renames @keyframes (srvj-tilt → srvj-tilt-<hash>),
     but the canvas preview references them via inline `style="animation: …"`,
     which Vue never rewrites. They must keep their original names to run. -->
<style>
@keyframes srvj-floaty {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-9px);
  }
}
@keyframes srvj-floaty2 {
  0%,
  100% {
    transform: translateY(0) rotate(-3deg);
  }
  50% {
    transform: translateY(-12px) rotate(-3deg);
  }
}
@keyframes srvj-draw {
  to {
    stroke-dashoffset: 0;
  }
}
@keyframes srvj-curA {
  0% {
    transform: translate(0, 0);
  }
  25% {
    transform: translate(120px, 40px);
  }
  55% {
    transform: translate(40px, 150px);
  }
  80% {
    transform: translate(180px, 90px);
  }
  100% {
    transform: translate(0, 0);
  }
}
@keyframes srvj-curB {
  0% {
    transform: translate(0, 0);
  }
  30% {
    transform: translate(-90px, 70px);
  }
  60% {
    transform: translate(-30px, -50px);
  }
  100% {
    transform: translate(0, 0);
  }
}
@keyframes srvj-pop {
  0% {
    opacity: 0;
    transform: scale(0.6);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}
@keyframes srvj-tilt {
  0%,
  100% {
    transform: perspective(2000px) rotateX(0deg) translateY(0);
  }
  50% {
    transform: perspective(2000px) rotateX(1.2deg) translateY(-6px);
  }
}
</style>
