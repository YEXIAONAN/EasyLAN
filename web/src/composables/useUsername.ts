import { ref } from "vue";

export function useUsername() {
  let saved = "";
  try {
    saved = localStorage.getItem("localchat.username") || "";
  } catch {
    /* Private browsing may block storage. */
  }
  const username = ref(validName(saved) ? saved : "");
  const dialogOpen = ref(!username.value);
  function save(name: string) {
    name = name.trim();
    if (!validName(name)) return false;
    username.value = name;
    try {
      localStorage.setItem("localchat.username", name);
    } catch {
      /* Name still works for this page. */
    }
    dialogOpen.value = false;
    return true;
  }
  return { username, dialogOpen, save };
}

export function validName(name: string) {
  return (
    name.trim().length > 0 &&
    [...name].length <= 32 &&
    !/[\u0000-\u001f\u007f-\u009f]/.test(name)
  );
}
