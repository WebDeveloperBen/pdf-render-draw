<script setup lang="ts">
import type { ProfileSetup, ProjectStepData, ProfessionType } from "~/types"

definePageMeta({
  layout: "blank",
  colorMode: "light"
})

const { data: profile } = useMultiStepForm<ProfileSetup, ProjectStepData>()

const roles: { id: number; name: ProfessionType; avatar: string }[] = [
  {
    id: 0,
    name: "Architect",
    avatar: "/images/avatars/architect.png"
  },
  {
    id: 1,
    name: "Builder",
    avatar: "/images/avatars/builder.png"
  },
  {
    id: 2,
    name: "Contractor",
    avatar: "/images/avatars/contractor.png"
  },
  {
    id: 3,
    name: "Electrician",
    avatar: "/images/avatars/electrician.png"
  },
  {
    id: 4,
    name: "Painter",
    avatar: "/images/avatars/painter.png"
  },
  {
    id: 5,
    name: "Plumber",
    avatar: "/images/avatars/plumber.webp"
  },
  {
    id: 6,
    name: "Supervisor",
    avatar: "/images/avatars/supervisor.png"
  },
  {
    id: 7,
    name: "Other",
    avatar: "/images/avatars/other.png"
  }
]
</script>

<template>
  <div class="bg-muted-100 min-h-screen">
    <UiBaseContainer>
      <form method="POST" class="mx-auto max-w-7xl px-4">
        <div>
          <div class="pt-8 text-center">
            <BaseHeading tag="h2" size="3xl" weight="medium" class="mb-2"> Choose a profession </BaseHeading>
            <BaseParagraph class="text-muted-500 mb-8"> Pick one of the following trades </BaseParagraph>
          </div>

          <div>
            <div class="w-full">
              <div class="mx-auto w-full max-w-3xl">
                <div class="w-full">
                  <div class="mb-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
                    <div
                      v-for="(role, idx) in roles"
                      :key="role.id"
                      class="relative flex items-center justify-center p-4"
                    >
                      <BaseRadioHeadless
                        :id="role.name"
                        v-model="profile.profession"
                        :name="`role-${role.id}`"
                        :value="role.name"
                        class="h-full w-full"
                      >
                        <div
                          class="relative mx-auto flex h-20 w-20 items-center justify-center grayscale transition-all duration-200 peer-checked:grayscale-0 peer-checked:[&_.child]:opacity-100"
                        >
                          <div
                            class="child absolute end-0 top-0 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-white opacity-0"
                          >
                            <Icon name="ph:check-circle-duotone" class="text-mmOrange h-6 w-6" />
                          </div>
                          <BaseAvatar
                            size="xl"
                            rounded="none"
                            :src="role.avatar"
                            class="group-focus-within:outline-muted-300 mx-auto group-focus-within:outline-dashed group-focus-within:outline-offset-2"
                          />
                        </div>
                        <div class="mt-3 text-center">
                          <BaseText size="sm" class="text-muted-500">{{ role.name }}</BaseText>
                        </div>
                      </BaseRadioHeadless>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </UiBaseContainer>
  </div>
</template>
