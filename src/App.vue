<template>
  <main class="app-shell">
    <section class="hero-card">
      <p class="eyebrow">Vue 3 + TypeScript</p>
      <h1>digital-human</h1>
      <p class="description">
        A minimal Vite starter is ready in this repository.
      </p>
    </section>
  </main>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
}

.hero-card {
  width: min(560px, 100%);
  padding: 40px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.12);
}

.eyebrow {
  margin: 0 0 12px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #2563eb;
}

h1 {
  margin: 0;
  font-size: clamp(40px, 8vw, 64px);
  line-height: 1;
  color: #0f172a;
}

.description {
  margin: 16px 0 0;
  font-size: 16px;
  line-height: 1.6;
  color: #475569;
}
</style>

