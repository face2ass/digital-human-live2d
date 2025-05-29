<template>
  <teleport to="body">
    <transition name="modal">
      <div v-if="model" id="gallery-modal">
        <div class="modal-mask">
          <div class="modal-container">
            <div class="modal-header">
              <button
                :class="{ active: activeTab === 'people' }"
                @click="activeTab = 'people'"
              >
                人物
              </button>
              <button
                :class="{ active: activeTab === 'background' }"
                @click="activeTab = 'background'"
              >
                背景
              </button>
            </div>

            <div class="modal-content">
              <div class="gallery-grid">
                <div
                  v-for="item in currentItems"
                  :key="item.id"
                  class="gallery-item"
                  :class="{ selected: item.id === currentSelection }"
                  @click="handleSelect(item)"
                >
                  <div class="image-container">
                    <img :src="item.imageUrl" :alt="item.title">
                  </div>
                  <div class="title">{{ item.title }}</div>
                </div>
              </div>
            </div>

            <div class="modal-footer">
              <button class="cancel" @click="model = false">取消</button>
              <button
                class="confirm"
                :disabled="!currentSelection"
                @click="handleConfirm"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
import {ref, computed} from 'vue'

type GalleryItem = {
  id: string | number
  title: string
  imageUrl: string
}

type GalleryItems = {
  people: GalleryItem[]
  background: GalleryItem[]
}

type TabType = 'people' | 'background'

const props = defineProps<{
  items: GalleryItems
}>()

const emit = defineEmits<{
  (e: 'confirm', payload: { type: TabType, item: GalleryItem }): void
}>()

const model = defineModel<boolean>({required: true})
const activeTab = ref<TabType>('people')
const selectedPeopleId = ref<string | number | null>(null)
const selectedBackgroundId = ref<string | number | null>(null)

const currentItems = computed(() => props.items[activeTab.value])
const currentSelection = computed(() =>
  activeTab.value === 'people'
    ? selectedPeopleId.value
    : selectedBackgroundId.value
)

const handleSelect = (item: GalleryItem) => {
  if (activeTab.value === 'people') {
    selectedPeopleId.value = item.id
  } else {
    selectedBackgroundId.value = item.id
  }
}

const handleConfirm = () => {
  if (!currentSelection.value) return

  const selectedItem = currentItems.value.find(
    item => item.id === currentSelection.value
  )

  if (selectedItem) {
    emit('confirm', {
      type: activeTab.value,
      item: selectedItem
    })
    model.value = false
  }
}
</script>

<style lang="scss">
#gallery-modal {
  > .modal-mask {
    position: fixed;
    z-index: 9998;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;

    > .modal-container {
      width: 800px;
      background: white;
      border-radius: 8px;
      padding: 20px;

      > .modal-header {
        display: flex;
        gap: 20px;
        border-bottom: 1px solid #eee;
        padding-bottom: 15px;

        > button {
          padding: 8px 20px;
          border: none;
          background: none;
          cursor: pointer;
          font-size: 16px;
          color: #666;

          &.active {
            color: #2196f3;
            border-bottom: 2px solid #2196f3;
          }
        }
      }

      > .modal-content {
        padding: 20px 0;
        min-height: 400px;

        > .gallery-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;

          > .gallery-item {
            cursor: pointer;
            transition: transform 0.2s;

            &:hover {
              transform: translateY(-5px);

              > .image-container > img {
                transform: scale(1.1);
              }
            }

            &.selected > .image-container {
              border-color: #2196f3;
            }
          }
        }
      }

      > .modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        padding-top: 20px;
        border-top: 1px solid #eee;

        > button {
          padding: 8px 20px;
          border-radius: 4px;
          cursor: pointer;
          transition: opacity 0.2s;

          &:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          &.confirm {
            background-color: #2196f3;
            color: white;
            border: none;

            &:not(:disabled):hover {
              opacity: 0.9;
            }
          }

          &.cancel {
            background-color: #eee;
            border: none;
          }
        }
      }
    }
  }

  .image-container {
    width: 100%;
    height: 160px;
    border-radius: 8px;
    overflow: hidden;
    border: 2px solid transparent;
    transition: border-color 0.2s;

    > img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.3s ease;
    }
  }

  .title {
    margin-top: 8px;
    text-align: center;
    font-size: 14px;
    color: #666;
  }
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
<!--import { Image } from "@nextui-org/react";-->
<!--import { Tabs, Tab } from "@nextui-org/react";-->
<!--import { Card, CardBody, CardFooter } from "@nextui-org/react";-->
<!--import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, useDisclosure } from "@nextui-org/react";-->
<!--import { CharacterManager } from "@/app/lib/character"-->
<!--import { InteractionMode, useInteractionModeStore, useCharacterStore, useBackgroundStore } from "@/app/lib/store";-->
<!--import clsx from "clsx";-->
<!--import { ReactNode } from "react";-->

<!--function CharacterGallery() {-->
<!--    const { character, setCharacter } = useCharacterStore();-->
<!--    const choiceCharacter = (c: string) => {-->
<!--        if (c === character) return;-->
<!--        setCharacter(c);-->
<!--        CharacterManager.getInstance().setCharacter(c);-->
<!--    }-->

<!--    const interactionMode = useInteractionModeStore((state) => state.mode)-->
<!--    const portraits = CharacterManager.getInstance().getLive2dPortraits();-->

<!--    return (-->
<!--        interactionMode != InteractionMode.CHATBOT ?-->
<!--            <div className="gap-6 grid grid-cols-2 sm:grid-cols-4 max-h-96">-->
<!--                {Object.keys(portraits).map((item, index) => (-->
<!--                    <Card-->
<!--                        shadow="md"-->
<!--                        key={index}-->
<!--                        isPressable-->
<!--                        onPress={() => choiceCharacter(item)}-->
<!--                        className={clsx(-->
<!--                            "text-small justify-between h-fit",-->
<!--                            {-->
<!--                                ' text-blue-600 border-2 border-indigo-600': item === character,-->
<!--                            },-->
<!--                        )-->
<!--                        }-->
<!--                    >-->
<!--                        <CardBody className="overflow-visible p-0">-->
<!--                            <Image-->
<!--                                shadow="sm"-->
<!--                                radius="lg"-->
<!--                                width="100%"-->
<!--                                alt={item}-->
<!--                                className="w-full object-cover h-[140px]"-->
<!--                                src={portraits[item]}-->
<!--                                isZoomed={true}-->
<!--                                style={{ objectFit: "scale-down" }}-->
<!--                            />-->
<!--                        </CardBody>-->
<!--                        <CardFooter className="text-small justify-between">-->
<!--                            <b>{item}</b>-->
<!--                        </CardFooter>-->
<!--                    </Card>-->
<!--                ))}-->
<!--            </div>-->
<!--            :-->
<!--            <span>聊天模式不支持人物设置</span>-->
<!--    );-->

<!--}-->

<!--function BackgroundGallery() {-->
<!--    const { background, setBackground } = useBackgroundStore();-->
<!--    const choiceBackground = (b: string | null) => {-->
<!--        if (b === background) return;-->
<!--        setBackground(b);-->
<!--    }-->

<!--    const interactionMode = useInteractionModeStore((state) => state.mode)-->
<!--    const backImages: {[key: string]: string} = CharacterManager.getInstance().getBackImages();-->

<!--    return (-->
<!--        interactionMode != InteractionMode.CHATBOT ?-->
<!--            <div className="gap-6 grid grid-cols-2 sm:grid-cols-4 max-h-96">-->
<!--                {[null, ...Object.keys(backImages)].map((item, index) => (-->
<!--                    <Card-->
<!--                        shadow="md"-->
<!--                        key={index}-->
<!--                        isPressable-->
<!--                        onPress={() => choiceBackground(item)}-->
<!--                        className={clsx(-->
<!--                            "text-small justify-between h-fit",-->
<!--                            {-->
<!--                                ' text-blue-600 border-2 border-indigo-600': item === background,-->
<!--                            },-->
<!--                        )-->
<!--                        }-->
<!--                    >-->
<!--                        <CardBody className="overflow-visible p-0">-->
<!--                            <Image-->
<!--                                shadow="sm"-->
<!--                                radius="lg"-->
<!--                                width="100%"-->
<!--                                alt={item != null ? item : "empty"}-->
<!--                                className="w-full object-cover h-[140px]"-->
<!--                                src={item != null ? backImages[item] : ""}-->
<!--                                isZoomed={true}-->
<!--                                style={{ objectFit: "cover" }}-->
<!--                            />-->
<!--                        </CardBody>-->
<!--                        <CardFooter className="text-small justify-between">-->
<!--                            <b>{item != null ? item : "empty"}</b>-->
<!--                        </CardFooter>-->
<!--                    </Card>-->
<!--                ))}-->
<!--            </div>-->
<!--            :-->
<!--            <span>聊天模式不支持背景设置</span>-->
<!--    );-->

<!--}-->

<!--function GalleryTabs() {-->
<!--    return (-->
<!--        <Tabs aria-label="Options">-->
<!--            <Tab key="character" title="人物">-->
<!--                <Card>-->
<!--                    <CardBody>-->
<!--                        <CharacterGallery />-->
<!--                    </CardBody>-->
<!--                </Card>-->
<!--            </Tab>-->
<!--            <Tab key="background" title="背景">-->
<!--                <Card>-->
<!--                    <CardBody>-->
<!--                        <BackgroundGallery />-->
<!--                    </CardBody>-->
<!--                </Card>-->
<!--            </Tab>-->
<!--        </Tabs>-->
<!--    )-->
<!--}-->

<!--export default function Gallery({isOpen: open, trigger, onClose}: {isOpen?: boolean; trigger?:ReactNode; onClose?: () => void}) {-->
<!--    const { isOpen, onOpen, onOpenChange } = useDisclosure({isOpen: open, onClose});-->
<!--    return (-->
<!--        <>-->
<!--            {-->
<!--                trigger ? <div onClick={() => {-->
<!--                    onOpen();-->
<!--                }}>{trigger}</div> : null-->
<!--            }-->
<!--            <Modal-->
<!--                isOpen={isOpen}-->
<!--                onOpenChange={onOpenChange}-->
<!--                size="5xl"-->
<!--                placement="center"-->
<!--                scrollBehavior="outside"-->
<!--            >-->
<!--                <ModalContent>-->
<!--                    {(onClose) => (-->
<!--                        <>-->
<!--                            <ModalHeader className="flex flex-col gap-1">Gallery</ModalHeader>-->
<!--                            <ModalBody>-->
<!--                                <div className="flex w-full flex-col">-->
<!--                                    <GalleryTabs />-->
<!--                                </div>-->
<!--                            </ModalBody>-->
<!--                            <ModalFooter>-->
<!--                                <Button color="danger" variant="light" onPress={onClose}>-->
<!--                                    Close-->
<!--                                </Button>-->
<!--                            </ModalFooter>-->
<!--                        </>-->
<!--                    )}-->
<!--                </ModalContent>-->
<!--            </Modal>-->
<!--        </>-->
<!--    );-->
<!--}-->