<script setup lang="ts">
import type { ProfileSetup, ProjectStepData } from "~/types"

definePageMeta({
  layout: "blank",
  colorMode: "light"
})

const { data: profile } = useMultiStepForm<ProfileSetup, ProjectStepData>()

const isOpen = shallowRef(true)
</script>

<template>
  <LazyFormsModalAccountConfirmed :modal-open="isOpen" @close-modal="isOpen = !isOpen" />
  <div class="bg-muted-100 min-h-screen">
    <div class="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4"></div>
    <form action="" method="POST" class="mx-auto max-w-7xl px-4" @submit.prevent>
      <div>
        <div class="pt-8 text-center">
          <BaseHeading tag="h2" size="3xl" weight="medium" class="mb-2"> Let's setup your profile. </BaseHeading>
          <BaseParagraph class="text-muted-500 max-w-3xl mx-auto mb-8">
            Select your gender or don't you choose, it stays between us either way.
          </BaseParagraph>
        </div>

        <div>
          <div class="w-full">
            <div class="mx-auto w-full">
              <div class="w-full">
                <div class="mx-auto mb-8 grid max-w-4xl gap-6 sm:grid-cols-3">
                  <BaseRadioHeadless v-model="profile.gender" name="radio_custom" value="male">
                    <BaseCard
                      shape="curved"
                      class="peer-checked:!border-mmOrange relative border-2 p-8 opacity-60 grayscale peer-checked:opacity-100 peer-checked:grayscale-0 peer-checked:[&_.child]:!opacity-100"
                    >
                      <div class="flex flex-col text-center">
                        <img
                          src="/images/male.webp"
                          alt="2 factor authentication with email"
                          class="mx-auto mb-3 max-w-[160px] max-h-[160px]"
                        />
                        <BaseHeading size="md" weight="medium">Male</BaseHeading>
                        <BaseParagraph size="xs" lead="snug" class="text-muted-500">
                          Pick this one if you're a bloke. No worries, you can change it later.
                        </BaseParagraph>
                      </div>
                      <div class="child absolute end-2 top-3 opacity-0">
                        <Icon name="ph:check-circle-duotone" class="text-mmOrange h-7 w-7" />
                      </div>
                    </BaseCard>
                  </BaseRadioHeadless>
                  <BaseRadioHeadless v-model="profile.gender" name="radio_custom" value="female">
                    <BaseCard
                      shape="curved"
                      class="peer-checked:!border-mmOrange relative border-2 p-8 opacity-60 grayscale peer-checked:opacity-100 peer-checked:grayscale-0 peer-checked:[&_.child]:!opacity-100"
                    >
                      <div class="flex flex-col text-center">
                        <img
                          src="/images/female.webp"
                          alt="2 factor authentication with SMS"
                          class="mx-auto mb-3 max-w-[160px] max-h-[160px]"
                        />
                        <BaseHeading size="md" weight="medium">Female</BaseHeading>
                        <BaseParagraph size="xs" lead="snug" class="text-muted-500">
                          Go for this if you're a sheila. No worries, you can change it later.
                        </BaseParagraph>
                      </div>
                      <div class="child absolute end-2 top-3 opacity-0">
                        <Icon name="ph:check-circle-duotone" class="text-mmOrange h-7 w-7" />
                      </div>
                    </BaseCard>
                  </BaseRadioHeadless>
                  <BaseRadioHeadless v-model="profile.gender" name="radio_custom" value="undisclosed">
                    <BaseCard
                      shape="curved"
                      class="peer-checked:!border-mmOrange relative border-2 p-8 opacity-60 grayscale peer-checked:opacity-100 peer-checked:grayscale-0 peer-checked:[&_.child]:!opacity-100"
                    >
                      <div class="flex flex-col text-center">
                        <svg
                          class="mx-auto mb-3 fill-gray-800 opacity-60 max-w-[160px] max-h-[160px]"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                        >
                          <path
                            fill="currentColor"
                            fill-rule="evenodd"
                            d="M12 1C5.925 1 1 5.925 1 12s4.925 11 11 11s11-4.925 11-11S18.075 1 12 1m-1.108 7.935c.23-.453.4-.668.541-.78c.106-.084.25-.155.567-.155c.625 0 1 .47 1 .978c0 .278-.054.416-.202.592c-.207.246-.59.545-1.348 1.046l-.45.296V13a1 1 0 1 0 2 0v-1.017c.542-.374.997-.732 1.327-1.124c.477-.566.673-1.17.673-1.881C15 7.508 13.867 6 12 6c-.684 0-1.289.176-1.808.587c-.484.383-.814.91-1.084 1.445a1 1 0 1 0 1.784.903M13 16.5a1 1 0 1 0-2 0v.5a1 1 0 1 0 2 0z"
                            clip-rule="evenodd"
                          />
                        </svg>
                        <BaseHeading size="md" weight="medium">Undisclosed</BaseHeading>
                        <BaseParagraph size="xs" lead="snug" class="text-muted-500">
                          Just so you know, it's easy to update this later in your profile.
                        </BaseParagraph>
                      </div>
                      <div class="child absolute end-2 top-3 opacity-0">
                        <Icon name="ph:check-circle-duotone" class="text-mmOrange h-7 w-7" />
                      </div>
                    </BaseCard>
                  </BaseRadioHeadless>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  </div>
</template>
