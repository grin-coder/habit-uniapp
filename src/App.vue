<script setup lang="ts">
import { onLaunch, onShow } from '@dcloudio/uni-app'
import { initStorage } from '@/domain/storage'

function configureStatusBar() {
  if (typeof plus === 'undefined' || !plus.navigator) return
  plus.navigator.setStatusBarBackground('#F7F5EE')
  plus.navigator.setStatusBarStyle('dark')
}

onLaunch(() => {
  void initStorage()
  configureStatusBar()
})

onShow(() => configureStatusBar())
</script>

<style></style>
