<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

const { user, signOut } = useAuth()
const router = useRouter()

async function onSignOut() {
  await signOut()
  router.push({ name: 'signin' })
}
</script>

<template>
  <main class="min-h-screen bg-background p-6">
    <div class="mx-auto flex max-w-3xl flex-col gap-6">
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-semibold">Genesis</h1>
        <Button variant="outline" @click="onSignOut">Sign out</Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Welcome{{ user?.email ? `, ${user.email}` : '' }}</CardTitle>
          <CardDescription>
            HighLevel connection and projects land here in the next phases.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p class="text-sm text-muted-foreground">Not connected to HighLevel yet.</p>
        </CardContent>
      </Card>
    </div>
  </main>
</template>
