<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { FirebaseError } from 'firebase/app'
import { useAuth } from '@/composables/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

const { signIn } = useAuth()
const router = useRouter()
const route = useRoute()

async function onSubmit() {
  error.value = ''
  loading.value = true
  try {
    await signIn(email.value, password.value)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard'
    router.push(redirect)
  } catch (e) {
    error.value = e instanceof FirebaseError ? e.code.replace('auth/', '').replaceAll('-', ' ') : 'Something went wrong'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-background p-6">
    <Card class="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Welcome back to Genesis.</CardDescription>
      </CardHeader>
      <form @submit.prevent="onSubmit">
        <CardContent class="flex flex-col gap-4">
          <div class="flex flex-col gap-2">
            <Label for="email">Email</Label>
            <Input id="email" v-model="email" type="email" autocomplete="email" required />
          </div>
          <div class="flex flex-col gap-2">
            <Label for="password">Password</Label>
            <Input id="password" v-model="password" type="password" autocomplete="current-password" required />
          </div>
          <p v-if="error" class="text-sm text-destructive capitalize">{{ error }}</p>
        </CardContent>
        <CardFooter class="flex flex-col gap-4">
          <Button type="submit" class="w-full" :disabled="loading">
            {{ loading ? 'Signing in…' : 'Sign in' }}
          </Button>
          <p class="text-sm text-muted-foreground">
            Don't have an account?
            <RouterLink to="/signup" class="text-foreground underline underline-offset-4">Sign up</RouterLink>
          </p>
        </CardFooter>
      </form>
    </Card>
  </main>
</template>
