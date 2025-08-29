<script setup lang="ts">
import { onErrorCaptured, ref } from "vue";

const currentError = ref<Error | null>();

onErrorCaptured((error: Error) => {
  currentError.value = error;

  return false;
});
</script>
