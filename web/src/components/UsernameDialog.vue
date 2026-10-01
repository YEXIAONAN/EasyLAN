<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { validName } from "../composables/useUsername";
const props = defineProps<{ open: boolean; username: string }>();
const emit = defineEmits<{ save: [name: string]; close: [] }>();
const name = ref("");
const input = ref<HTMLInputElement>();
const invalid = ref(false);
watch(
  () => props.open,
  async (open) => {
    if (!open) return;
    name.value = props.username;
    invalid.value = false;
    await nextTick();
    input.value?.focus();
  },
  { immediate: true },
);
function submit() {
  invalid.value = !validName(name.value.trim());
  if (!invalid.value) emit("save", name.value.trim());
}
function trap(event: KeyboardEvent) {
  if (event.key !== "Tab") return;
  const items = Array.from(
    (event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>(
      "input, button",
    ),
  );
  const first = items[0],
    last = items.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  }
  if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}
</script>

<template>
  <div
    v-if="open"
    class="dialog-backdrop"
    @keydown.esc="username && emit('close')"
    @keydown="trap"
  >
    <form
      class="username-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
      @submit.prevent="submit"
    >
      <div class="brand-mark">L<span>·</span></div>

      <h1 id="welcome-title">
        {{ username ? "Change your name" : "Welcome to LocalChat" }}
      </h1>
      <p class="dialog-description">
        Choose a name to identify this browser on your local network.
      </p>
      <label for="username">Your name</label>
      <input
        id="username"
        ref="input"
        v-model="name"
        placeholder="e.g. Waiting or Server-01"
        autocomplete="nickname"
        :aria-invalid="invalid"
        aria-describedby="name-hint"
      />
      <p id="name-hint" class="input-hint" :class="{ 'text-danger': invalid }">
        {{
          invalid
            ? "Use 1–32 characters, without control characters."
            : "Saved in this browser. No account required."
        }}
      </p>
      <button class="button primary full-width" type="submit">
        {{ username ? "Save name" : "Enter LocalChat" }}
        <span aria-hidden="true">↗</span>
      </button>
      <button
        v-if="username"
        class="button subtle full-width"
        type="button"
        @click="emit('close')"
      >
        Cancel
      </button>
    </form>
  </div>
</template>
