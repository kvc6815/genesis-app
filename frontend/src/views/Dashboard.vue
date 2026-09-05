<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useHighLevelConnection } from '@/composables/useHighLevelConnection'
import { useProjects } from '@/composables/useProjects'
import ProjectCard from '@/components/ProjectCard.vue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const { user, signOut } = useAuth()
const { status, loading, buildConnectUrl } = useHighLevelConnection()
const { projects, loading: projectsLoading, createProject, softDeleteProject } = useProjects()
const router = useRouter()
const route = useRoute()

const oauthResult = ref<'connected' | 'error' | null>(null)
const oauthErrorReason = ref<string | null>(null)
const connecting = ref(false)

const createOpen = ref(false)
const newProjectName = ref('')
const newProjectDescription = ref('')
const creating = ref(false)

const initials = computed(() => (user.value?.email?.[0] ?? '?').toUpperCase())

onMounted(() => {
  const hl = route.query.hl
  if (hl === 'connected' || hl === 'error') {
    oauthResult.value = hl
    oauthErrorReason.value = typeof route.query.reason === 'string' ? route.query.reason : null
    router.replace({ query: {} })
  }
})

async function onSignOut() {
  await signOut()
  router.push({ name: 'signin' })
}

async function onConnectHighLevel() {
  connecting.value = true
  try {
    window.location.href = await buildConnectUrl()
  } catch {
    connecting.value = false
  }
}

async function onCreateProject() {
  creating.value = true
  try {
    await createProject(newProjectName.value.trim(), newProjectDescription.value.trim())
    newProjectName.value = ''
    newProjectDescription.value = ''
    createOpen.value = false
  } finally {
    creating.value = false
  }
}

function onDeleteProject(projectId: string) {
  void softDeleteProject(projectId)
}
</script>

<template>
  <main class="min-h-screen bg-background">
    <header class="flex items-center justify-between border-b px-6 py-3">
      <div class="flex items-baseline gap-2">
        <span class="font-semibold">Genesis</span>
        <span class="text-sm text-muted-foreground">/ projects</span>
      </div>
      <div class="flex items-center gap-3">
        <Badge v-if="!loading" variant="outline" class="gap-1.5">
          <span
            class="h-2 w-2 rounded-full"
            :class="status.connected ? 'bg-green-500' : 'bg-red-500'"
          />
          {{ status.connected ? 'HighLevel Connected' : 'HighLevel Not Connected' }}
        </Badge>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Avatar class="h-7 w-7 cursor-pointer">
              <AvatarFallback>{{ initials }}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel class="font-normal text-muted-foreground">{{ user?.email }}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem @click="onSignOut">Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>

    <div class="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <p v-if="oauthResult === 'connected'" class="rounded-md bg-primary/10 px-4 py-2 text-sm text-primary">
        HighLevel connected successfully.
      </p>
      <p v-else-if="oauthResult === 'error'" class="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
        Could not connect HighLevel{{ oauthErrorReason ? ` (${oauthErrorReason.replaceAll('_', ' ')})` : '' }}.
        Please try again.
      </p>

      <div
        v-if="!loading && !status.connected"
        class="flex items-center justify-between gap-4 rounded-md border border-dashed border-amber-300 bg-amber-50 p-4"
      >
        <div class="flex flex-col gap-1">
          <p class="font-medium">Connect your HighLevel account</p>
          <p class="text-sm text-muted-foreground">OAuth 2.0 — required before generating apps</p>
        </div>
        <Button :disabled="connecting" @click="onConnectHighLevel">
          {{ connecting ? 'Redirecting…' : 'Connect HighLevel →' }}
        </Button>
      </div>

      <div class="flex items-baseline justify-between">
        <h2 class="font-semibold">Projects</h2>
        <Dialog v-model:open="createOpen">
          <DialogTrigger as-child>
            <Button variant="outline" size="sm">+ New project</Button>
          </DialogTrigger>
          <DialogContent>
            <form @submit.prevent="onCreateProject">
              <DialogHeader>
                <DialogTitle>New project</DialogTitle>
                <DialogDescription>Give it a name and a short description of what it'll do.</DialogDescription>
              </DialogHeader>
              <div class="flex flex-col gap-4 py-4">
                <div class="flex flex-col gap-2">
                  <Label for="project-name">Name</Label>
                  <Input id="project-name" v-model="newProjectName" required maxlength="80" />
                </div>
                <div class="flex flex-col gap-2">
                  <Label for="project-description">Description</Label>
                  <Textarea id="project-description" v-model="newProjectDescription" rows="3" maxlength="280" />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" :disabled="creating || !newProjectName.trim()">
                  {{ creating ? 'Creating…' : 'Create project' }}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <p v-if="projectsLoading" class="text-sm text-muted-foreground">Loading projects…</p>
      <Card
        v-else-if="projects.length === 0"
        class="flex min-h-32 items-center justify-center border-dashed p-10 text-center text-sm text-muted-foreground"
      >
        Describe your first app to get started.
      </Card>
      <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ProjectCard
          v-for="project in projects"
          :key="project.id"
          :project="project"
          @delete="onDeleteProject"
        />
      </div>
    </div>
  </main>
</template>
