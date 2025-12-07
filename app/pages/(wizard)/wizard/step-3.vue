<script setup lang="ts">
import type { ProfileSetup, ProjectStepData } from "../../types"
definePageMeta({
  layout: "blank",
  colorMode: "light"
})

const { data: profile, errors } = useMultiStepForm<ProfileSetup, ProjectStepData>()

const avatarPreview = useNinjaFilePreview(() => profile.value.avatar)

// BaseInputFileHeadless gives us a listfile input, but we need to
// extract the file from the list and set it to the form
const inputFile = ref<FileList | null>(null)
watch(inputFile, (value) => {
  const file = value?.item(0) || null
  profile.value.avatar = file
})
</script>

<template>
  <div>
    <UiBaseContainer>
      <WizardStepTitle />

      <div class="mx-auto flex w-full max-w-5xl flex-col px-4">
        <div class="flex items-center justify-center">
          <BaseFullscreenDropfile
            icon="ph:image-duotone"
            :filter-file-dropped="(file) => file.type.startsWith('image')"
            @drop="
              (value) => {
                inputFile = value
              }
            "
          />
          <BaseInputFileHeadless id="avatar" v-slot="{ open, remove, files }" v-model="inputFile" accept="image/*">
            <div class="relative h-20 w-20">
              <img
                v-if="avatarPreview"
                :src="avatarPreview"
                alt="Upload preview"
                class="bg-muted-200 h-20 w-20 rounded-full object-cover object-center"
              />
              <img
                v-else
                src="/placeholders/file.png"
                alt="Upload preview"
                class="bg-muted-200 h-20 w-20 rounded-full object-cover object-center"
              />
              <div v-if="files?.length && files.item(0)" class="absolute bottom-0 end-0 z-20">
                <BaseButtonIcon condensed shape="full" tooltip="Remove image" @click="remove(files.item(0)!)">
                  <Icon name="lucide:x" class="h-4 w-4" />
                </BaseButtonIcon>
              </div>
              <div v-else class="absolute bottom-0 end-0 z-20">
                <div class="relative" tooltip="Upload image">
                  <BaseButtonIcon rounded="full" @click="open">
                    <Icon name="lucide:plus" class="h-4 w-4" />
                  </BaseButtonIcon>
                </div>
              </div>
            </div>
          </BaseInputFileHeadless>
        </div>

        <div class="my-4 text-center font-sans">
          <p class="text-muted-500 text-sm">Upload a profile picture</p>
          <p class="text-muted-400 text-xs">File size cannot exceed 2MB</p>
        </div>
        <div class="mx-auto flex w-full max-w-sm flex-col gap-3 mt-3">
          <UiFormInput
            id="name"
            type="text"
            :error="errors.name"
            label="Your name"
            placeholder="Enter your name"
            @update:model-value="profile.name = $event"
            @focused="(e) => (errors.name = '')"
            ><span class="text-red-500">*</span></UiFormInput
          >
          <UiFormTextarea
            id="bio"
            type="text"
            label="Describe yourself"
            :rows="4"
            placeholder="Create a bio for your profile..."
            @update:model-value="profile.bio = $event"
          />
        </div>
      </div>
    </UiBaseContainer>
  </div>
</template>
