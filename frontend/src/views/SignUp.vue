<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
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

const { signUp } = useAuth()
const router = useRouter()

async function onSubmit() {
  error.value = ''
  loading.value = true
  try {
    await signUp(email.value, password.value)
    router.push({ name: 'dashboard' })
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
        <CardTitle>Create an account</CardTitle>
        <CardDescription>Sign up to start building with Genesis.</CardDescription>
      </CardHeader>
      <form @submit.prevent="onSubmit">
        <CardContent class="flex flex-col gap-4">
          <div class="flex flex-col gap-2">
            <Label for="email">Email</Label>
            <Input id="email" v-model="email" type="email" autocomplete="email" required />
          </div>
          <div class="flex flex-col gap-2">
            <Label for="password">Password</Label>
            <Input
              id="password"
              v-model="password"
              type="password"
              autocomplete="new-password"
              minlength="6"
              required
            />
          </div>
          <p v-if="error" class="text-sm text-destructive capitalize">{{ error }}</p>
        </CardContent>
        <CardFooter class="flex flex-col gap-4">
          <Button type="submit" class="w-full" :disabled="loading">
            {{ loading ? 'Creating account…' : 'Sign up' }}
          </Button>
          <p class="text-sm text-muted-foreground">
            Already have an account?
            <RouterLink to="/signin" class="text-foreground underline underline-offset-4">Sign in</RouterLink>
          </p>
        </CardFooter>
      </form>
    </Card>
  </main>
</template>
