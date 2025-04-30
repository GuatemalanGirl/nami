import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import * as TWEEN from "tween"

const paintingsData = [
  {
    filename: "design_art.jpg",
    title: "Design Art",
    description:
      "“그림이 말을 걸어온다…, Design? Art?!”<br>“ART(예술)라는 산에서 대중(우리)에게 내려온 디자인! 그리고 그림!”<br>현대 사회에서는 예술과 디자인의 경계가 점점 모호해지고 있습니다. 팝아트의 위대한 창시자 앤디 워홀은 일부 특권층만의 전유물로 여기던 예술(그림)을 우리 곁으로 끌어내리고, 평범한 대중들이여! 우리 모두 마음껏 예술을 즐기자고 외쳤지요. 앤디 워홀의 작품 주제는 대부분 우리와 매우 친숙한 인물이나 상품들입니다. 부드럽고 매혹적이며 아름답기 그지없는 아르누보 미술의 창시자 알폰스 무하는 화장품, 카페의 포스터 제작자로 그의 예술을 시작했습니다. 툴루즈 로트렉 역시, 파리의 유명한 댄스홀인 물랭루즈의 포스터 작가입니다. 라퐁텐느 우화집의 삽화 작가인 앙리 르마리와 현대 그래픽 아트의 대가인 레미 블랑샤르에 이르기까지… 무겁고 진지하며, 엄격함을 고수하던 전통적인 예술(그림)을 오로지 우리와 같이 평범한 대중들에게 <선물하기> 위해 애쓴 선각자들! 이들의 작품 속에서 평범하지만 아름답고, 쉽지만 철학적이며, 친숙하지만 즐거운 새로운 예술 세계를 경험하길 기대합니다.",
  },
  {
    filename: "campbells_soup.jpg",
    title: "Campbell's Soup",
    description:
      "이 작품은 당시 캠벨 회사에서 판매하는 32종류의 수프를 하나씩 옮겨 그린 것 중 하나입니다. 워홀은 슈퍼마켓 진열장에서 흔히 보던 상품의 이미지를 그대로 재현했습니다. 그리고 이 깡통 이미지를 반복적으로 나열하여 일상 속 소비제품의 이미지를 예술 작품으로 바꾸어 내는 시도를 한 것입니다. 그것은 워홀의  선언이었습니다.",
  },
  {
    filename: "foundation_maeght.jpg",
    title: "Foundation Maeght",
    description:
      "호앙 미로는 친하게 지내던 매그 부부가 운영하는 매그 아트재단에서 자신의 전시회 포스터를 석판화로 다수 제작하였습니다. 무엇보다 은유적이며 시적이고 상징적인 표현 양식으로 대표되는 그의 작품은 어린아이 같은 순수함과 유쾌하고 천진한 해학과 유머, 의식과 무의식을 넘나드는 꿈의 세계를 담고 있습니다.",
  },
  {
    filename: "reve_de_viille_3.jpg",
    title: "Rêve de Ville III",
    description:
      "추상 풍경화는 일상적인 풍경 속에 상상력이 창조한 기발한 추상적 요소가 가미된 특별한 장르입니다. 멀리서 보면 단순한 풍경화이지만, 한발 한발 다가갈수록 눈을 떼지 못하게 하는 묘한 매력을 가지고 있지요. 이 작품 시리즈는 아름다운 자연과 동심의 이미지를 결합하여 신선한 자극과 동화와 같은 재미있는 이야기들을 들려줍니다. 맑고 투명한 색상은 유쾌한 느낌을 샘솟게 하고, 곳곳에서 튀어나오는 의외의 이미지들은 숨은 그림 찾기 놀이처럼 우리를 몰입하게 만듭니다. 마치 재미있는 마법의 세계로 떠나게 하는 설레이는 여행 가이드 같습니다.",
  },
  {
    filename: "diamond_dust_shoes.jpg",
    title: "Diamond Dust Shoes",
    description:
      "이 작품은 워홀의 친구이자 패션 디자이너가 의뢰한 신발 광고가 모티브가 되었습니다. 그 친구는 워홀의 스튜디어에 샘플로 쓸 신발 한 상자를 보냈는데, 워홀 조수의 실수로 신발이 바닥에 쏟아지고 말았습니다. 이 작품은 바로 그 장면을 담은 것입니다.",
  },
  {
    filename: "histoire_11.jpg",
    title: "Histoire 11",
    description:
      "16점의 시리즈 작품인 <망각의 역사>는 레미 블랑샤르의 유년 시절, 그의 아버지로부터 들은 집시들의 이야기, 아라비안 나이트, 동서양 여러나라의 전설들을 그의 <순진한 표현>으로 재창조한 것입니다. 마치 만화와 같은 자유롭고, 순진하며 그리고 즉각적인 의미나 느낌을 전달합니다. 이 시리즈 작품은 우리의 상상력과 기억을 통로로 하여, 우리를 어린 시절로의 시간 여행을 떠나게 합니다.",
  },
  {
    filename: "histoire_13.jpg",
    title: "Histoire 13",
    description:
      "16점의 시리즈 작품인 <망각의 역사>는 레미 블랑샤르의 유년 시절, 그의 아버지로부터 들은 집시들의 이야기, 아라비안 나이트, 동서양 여러나라의 전설들을 그의 <순진한 표현>으로 재창조한 것입니다. 마치 만화와 같은 자유롭고, 순진하며 그리고 즉각적인 의미나 느낌을 전달합니다. 이 시리즈 작품은 우리의 상상력과 기억을 통로로 하여, 우리를 어린 시절로의 시간 여행을 떠나게 합니다.",
  },
  {
    filename: "histoire_5.jpg",
    title: "Histoire 5",
    description:
      "16점의 시리즈 작품인 <망각의 역사>는 레미 블랑샤르의 유년 시절, 그의 아버지로부터 들은 집시들의 이야기, 아라비안 나이트, 동서양 여러나라의 전설들을 그의 <순진한 표현>으로 재창조한 것입니다. 마치 만화와 같은 자유롭고, 순진하며 그리고 즉각적인 의미나 느낌을 전달합니다. 이 시리즈 작품은 우리의 상상력과 기억을 통로로 하여, 우리를 어린 시절로의 시간 여행을 떠나게 합니다.",
  },
  {
    filename: "histoire_8.jpg",
    title: "Histoire 8",
    description:
      "16점의 시리즈 작품인 <망각의 역사>는 레미 블랑샤르의 유년 시절, 그의 아버지로부터 들은 집시들의 이야기, 아라비안 나이트, 동서양 여러나라의 전설들을 그의 <순진한 표현>으로 재창조한 것입니다. 마치 만화와 같은 자유롭고, 순진하며 그리고 즉각적인 의미나 느낌을 전달합니다. 이 시리즈 작품은 우리의 상상력과 기억을 통로로 하여, 우리를 어린 시절로의 시간 여행을 떠나게 합니다.",
  },
  {
    filename: "le_sarrasin.jpg",
    title: "Le Sarrasin",
    description:
      "사라센은 고대 아라비아반도의 유목민을 뜻합니다. 그들에게 별은 위치를 일러주는 대단히 중요한 것이었지요. 유목민의 얼굴이 연상되는 검은색의 형태와 밝은 빨간색면, 노란색과 녹색면이 역동적인 즐거움을 전해줍니다.",
  },
  {
    filename: "miro_ceret.jpg",
    title: "Miró à Céret",
    description:
      "스페인이 자랑하는 화가 호앙 미로의 작품은 은유적이며 시적이고 상징적입니다. 어린아이 같은 순수함과 유쾌하고 천진한 해학과 유머, 의식과 무의식을 넘나드는 꿈의 세계를 담고 있습니다.",
  },
  /*{
    filename: "reve_de_viille_3.jpg",
    title: "Rêve de Ville III",
    description:
      "추상 풍경화는 일상적인 풍경 속에 상상력이 창조한 기발한 추상적 요소가 가미된 특별한 장르입니다. 멀리서 보면 단순한 풍경화이지만, 한발 한발 다가갈수록 눈을 떼지 못하게 하는 묘한 매력을 가지고 있지요. 이 작품 시리즈는 아름다운 자연과 동심의 이미지를 결합하여 신선한 자극과 동화와 같은 재미있는 이야기들을 들려줍니다. 맑고 투명한 색상은 유쾌한 느낌을 샘솟게 하고, 곳곳에서 튀어나오는 의외의 이미지들은 숨은 그림 찾기 놀이처럼 우리를 몰입하게 만듭니다. 마치 재미있는 마법의 세계로 떠나게 하는 설레이는 여행 가이드 같습니다.",
  },
  {
    filename: "histoire_13.jpg",
    title: "Histoire 13",
    description:
      "16점의 시리즈 작품인 <망각의 역사>는 레미 블랑샤르의 유년 시절, 그의 아버지로부터 들은 집시들의 이야기, 아라비안 나이트, 동서양 여러나라의 전설들을 그의 <순진한 표현>으로 재창조한 것입니다. 마치 만화와 같은 자유롭고, 순진하며 그리고 즉각적인 의미나 느낌을 전달합니다. 이 시리즈 작품은 우리의 상상력과 기억을 통로로 하여, 우리를 어린 시절로의 시간 여행을 떠나게 합니다.",
  },
  {
    filename: "campbells_soup.jpg",
    title: "Campbell's Soup",
    description:
      "이 작품은 당시 캠벨 회사에서 판매하는 32종류의 수프를 하나씩 옮겨 그린 것 중 하나입니다. 워홀은 슈퍼마켓 진열장에서 흔히 보던 상품의 이미지를 그대로 재현했습니다. 그리고 이 깡통 이미지를 반복적으로 나열하여 일상 속 소비제품의 이미지를 예술 작품으로 바꾸어 내는 시도를 한 것입니다. 그것은 워홀의  선언이었습니다.",
  },
  {
    filename: "foundation_maeght.jpg",
    title: "Foundation Maeght",
    description:
      "호앙 미로는 친하게 지내던 매그 부부가 운영하는 매그 아트재단에서 자신의 전시회 포스터를 석판화로 다수 제작하였습니다. 무엇보다 은유적이며 시적이고 상징적인 표현 양식으로 대표되는 그의 작품은 어린아이 같은 순수함과 유쾌하고 천진한 해학과 유머, 의식과 무의식을 넘나드는 꿈의 세계를 담고 있습니다.",
  },
  {
    filename: "le_sarrasin.jpg",
    title: "Le Sarrasin",
    description:
      "사라센은 고대 아라비아반도의 유목민을 뜻합니다. 그들에게 별은 위치를 일러주는 대단히 중요한 것이었지요. 유목민의 얼굴이 연상되는 검은색의 형태와 밝은 빨간색면, 노란색과 녹색면이 역동적인 즐거움을 전해줍니다.",
  },*/
]

const ROOM_WIDTH = 20,
  ROOM_HEIGHT = 8,
  ROOM_DEPTH = 20
const CAMERA_FOV = 75,
  CAMERA_NEAR = 0.1,
  CAMERA_FAR = 1000
const INITIAL_CAMERA_POS = new THREE.Vector3(0, ROOM_HEIGHT, ROOM_DEPTH * 1.5)
const ZOOM_DISTANCE = 6,
  CAMERA_DURATION = 1000
const ZOOM_DISTANCE_CLOSER = 3 // 두 번째 줌 거리 추가
const PAINTING_WIDTH_LIMIT = ROOM_WIDTH / 4,
  PAINTING_HEIGHT_LIMIT = ROOM_HEIGHT / 3
const PAINTING_Y_OFFSET = 0,
  WALL_OFFSET = 0.01

let scene, camera, renderer, controls, raycaster, pointer
let paintings = [],
  currentPaintingIndex = -1
let isCameraMoving = false,
  isZoomedIn = false
let zoomedPainting = null // 현재 줌인된 그림을 저장할 변수
let zoomLevel = 0 // 줌 레벨 (0: 초기, 1: 1차 줌, 2: 2차 줌)

const textureLoader = new THREE.TextureLoader()

async function init() {
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xffe6cf)

  camera = new THREE.PerspectiveCamera(
    CAMERA_FOV,
    window.innerWidth / window.innerHeight,
    CAMERA_NEAR,
    CAMERA_FAR,
  )
  camera.position.copy(INITIAL_CAMERA_POS)
  camera.lookAt(0, PAINTING_Y_OFFSET, 0)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  document.body.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, PAINTING_Y_OFFSET, 0)
  controls.enableDamping = true
  controls.dampingFactor = 0.1
  controls.rotateSpeed = 0.5
  controls.zoomSpeed = 1.0
  controls.panSpeed = 0.4
  controls.update()

  raycaster = new THREE.Raycaster()
  pointer = new THREE.Vector2()

  const start = Date.now()

  createRoom()
  await placePaintings()
  addLights()

  const elapsed = Date.now() - start
  const minDuration = 1000
  const remaining = Math.max(0, minDuration - elapsed)

  setTimeout(() => {
    document.getElementById("loadingScreen").classList.add("hidden")
    showInstructions()
  }, remaining)

  document
    .getElementById("instructionOverlay")
    .addEventListener("click", hideInstructions)
  document.getElementById("leftButton").addEventListener("click", navigateLeft)
  document
    .getElementById("rightButton")
    .addEventListener("click", navigateRight)
  document.getElementById("infoButton").onclick = () => {
    const modal = document.getElementById("infoModal")
    const isVisible = modal.style.display === "block"
    if (isVisible) {
      closeInfo()
    } else {
      showInfo()
    }
  }
  document
    .getElementById("closeInfoButton")
    .addEventListener("click", closeInfo)
  renderer.domElement.addEventListener("click", onClick)

  renderer.domElement.addEventListener("dblclick", onDoubleClick)

  renderer.domElement.addEventListener(
    "touchend",
    (event) => {
      if (event.touches && event.touches.length > 1) return // 멀티터치는 무시
      event.preventDefault() // 스크롤 방지
      // 터치 위치 → pointer 위치로 변환
      const touch = event.changedTouches[0]
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1
      onClick(event)
    },
    { passive: false },
  )

  renderer.domElement.addEventListener("mousemove", onPointerMove)
  window.addEventListener("resize", onResize)

  animate()
}

function createRoom() {
  const textures = {
    floor: textureLoader.load(
      "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/floor/floor9.png",
    ),
    ceiling: textureLoader.load(
      "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/ceiling/ceiling4.png",
    ),
    front: textureLoader.load(
      "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/walls/walls2.png",
    ),
    back: textureLoader.load(
      "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/walls/walls2.png",
    ),
    left: textureLoader.load(
      "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/walls/walls2.png",
    ),
    right: textureLoader.load(
      "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/walls/walls2.png",
    ),
  }

  textures.floor.wrapS = THREE.RepeatWrapping
  textures.floor.wrapT = THREE.RepeatWrapping
  textures.floor.repeat.set(5, 5)

  textures.ceiling.wrapS = THREE.RepeatWrapping
  textures.ceiling.wrapT = THREE.RepeatWrapping
  textures.ceiling.repeat.set(1, 1)
  ;["front", "back", "left", "right"].forEach((side) => {
    textures[side].wrapS = THREE.RepeatWrapping
    textures[side].wrapT = THREE.RepeatWrapping
    textures[side].repeat.set(2, 1)
  })

  const makeWall = (
    geometry,
    material,
    position,
    rotation,
    name,
    shouldFlipNormal = false
  ) => {
    if (shouldFlipNormal) geometry.scale(-1, 1, 1)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.copy(position)
    mesh.rotation.copy(rotation)
    mesh.name = name // 이름설정
    scene.add(mesh)
    return mesh // 나중에 필요하면 mesh 반환 가능
  }

  makeWall(
    new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_DEPTH),
    new THREE.MeshStandardMaterial({ map: textures.floor }),
    new THREE.Vector3(0, -ROOM_HEIGHT / 2, 0),
    new THREE.Euler(-Math.PI / 2, 0, 0),
    "floor"
  )
  makeWall(
    new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_DEPTH),
    new THREE.MeshStandardMaterial({ map: textures.ceiling }),
    new THREE.Vector3(0, ROOM_HEIGHT / 2, 0),
    new THREE.Euler(-Math.PI / 2, 0, 0),
    "ceiling",
    true
  )
  makeWall(
    new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_HEIGHT),
    new THREE.MeshStandardMaterial({ map: textures.back }),
    new THREE.Vector3(0, PAINTING_Y_OFFSET, -ROOM_DEPTH / 2),
    new THREE.Euler(0, 0, 0),
    "back"
  )
  makeWall(
    new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_HEIGHT),
    new THREE.MeshStandardMaterial({ map: textures.front }),
    new THREE.Vector3(0, PAINTING_Y_OFFSET, ROOM_DEPTH / 2),
    new THREE.Euler(0, 0, 0),
    "front",
    true
  )
  makeWall(
    new THREE.PlaneGeometry(ROOM_DEPTH, ROOM_HEIGHT),
    new THREE.MeshStandardMaterial({ map: textures.left }),
    new THREE.Vector3(-ROOM_WIDTH / 2, PAINTING_Y_OFFSET, 0),
    new THREE.Euler(0, Math.PI / 2, 0),
    "left"
  )
  makeWall(
    new THREE.PlaneGeometry(ROOM_DEPTH, ROOM_HEIGHT),
    new THREE.MeshStandardMaterial({ map: textures.right }),
    new THREE.Vector3(ROOM_WIDTH / 2, PAINTING_Y_OFFSET, 0),
    new THREE.Euler(0, Math.PI / 2, 0), 
    "right",
    true
  )
}

function addLights() {
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
  scene.add(ambientLight)

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5)
  directionalLight.position.set(10, 20, 10)
  directionalLight.castShadow = true
  scene.add(directionalLight)
}

async function placePaintings() {
  const wallDefs = [
    {
      axis: "x",
      constVal: ROOM_DEPTH / 2 - WALL_OFFSET,
      width: ROOM_WIDTH,
      rotY: Math.PI,
      reverse: false,
    },
    {
      axis: "z",
      constVal: ROOM_WIDTH / 2 - WALL_OFFSET,
      width: ROOM_DEPTH,
      rotY: -Math.PI / 2,
      reverse: true,
    },
    {
      axis: "x",
      constVal: -ROOM_DEPTH / 2 + WALL_OFFSET,
      width: ROOM_WIDTH,
      rotY: 0,
      reverse: true,
    },
    {
      axis: "z",
      constVal: -ROOM_WIDTH / 2 + WALL_OFFSET,
      width: ROOM_DEPTH,
      rotY: Math.PI / 2,
      reverse: false,
    },
  ]

  const paintingsPerWall = Math.ceil(paintingsData.length / 4) // 유동적 계산
  let globalIndex = 0

  for (const wall of wallDefs) {
    const start = -wall.width / 2 + wall.width / (paintingsPerWall * 2)
    const spacing = wall.width / paintingsPerWall

    for (let i = 0; i < paintingsPerWall; i++) {
      if (globalIndex >= paintingsData.length) return // 남은 데이터 없으면 중단

      const pos = new THREE.Vector3()
      const localIndex = wall.reverse ? paintingsPerWall - 1 - i : i
      if (wall.axis === "x") {
        pos.x = start + localIndex * spacing
        pos.z = wall.constVal
      } else {
        pos.z = start + localIndex * spacing
        pos.x = wall.constVal
      }
      pos.y = PAINTING_Y_OFFSET

      const painting = await loadAndAddPainting(
        paintingsData[globalIndex],
        pos,
        wall.rotY,
      )
      globalIndex++
    }
  }
}

async function loadAndAddPainting(data, position, rotationY) {
  return new Promise((resolve, reject) => {
    const url = `https://raw.githubusercontent.com/GuatemalanGirl/mygallery/refs/heads/main/paintings/${data.filename}`
    textureLoader.load(
      url,
      (texture) => {
        const aspect = texture.image.width / texture.image.height
        let width = PAINTING_WIDTH_LIMIT
        let height = width / aspect
        if (height > PAINTING_HEIGHT_LIMIT) {
          height = PAINTING_HEIGHT_LIMIT
          width = height * aspect
        }

        const depth = 0.1 // 그림의 두께

        const geo = new THREE.BoxGeometry(width, height, depth)

        const materials = [
          new THREE.MeshStandardMaterial({ color: 0xffffff }), // 오른쪽
          new THREE.MeshStandardMaterial({ color: 0xffffff }), // 왼쪽
          new THREE.MeshStandardMaterial({ color: 0xffffff }), // 위
          new THREE.MeshStandardMaterial({ color: 0xffffff }), // 아래
          new THREE.MeshBasicMaterial({ map: texture }), // 앞 (그림)
          new THREE.MeshStandardMaterial({ color: 0xffffff }), // 뒤
        ]

        const mesh = new THREE.Mesh(geo, materials)
        mesh.position.copy(position)
        mesh.rotation.y = rotationY
        // 그림을 벽면으로 밀어주기
        const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(
          mesh.quaternion,
        ) // foward는 정면 방향을 의미
        mesh.position.copy(position).add(forward.multiplyScalar(depth / 2)) // depth / 2 만큼 그 방향으로 이동시키면 그림의 뒷면이 벽에 붙음

        mesh.userData = { isPainting: true, data }
        scene.add(mesh)
        paintings.push(mesh)
        resolve(mesh)
      },
      undefined,
      reject,
    )
  })
}

function showInfo() {
  if (currentPaintingIndex === -1) return
  const data = paintings[currentPaintingIndex].userData.data
  document.getElementById("infoContent").innerHTML =
    `<h2>${data.title}</h2><p>${data.description}</p>`
  document.getElementById("infoModal").style.display = "block"
}

function closeInfo() {
  document.getElementById("infoModal").style.display = "none"
}

function navigateLeft() {
  if (isCameraMoving || paintings.length === 0) return
  currentPaintingIndex = (currentPaintingIndex + 1) % paintings.length
  zoomTo(paintings[currentPaintingIndex], ZOOM_DISTANCE) // 첫 번째 줌 거리로 초기화
  zoomedPainting = paintings[currentPaintingIndex] // 줌인된 그림 업데이트
  zoomLevel = 1 // 줌 레벨 초기화
}

function navigateRight() {
  if (isCameraMoving || paintings.length === 0) return
  currentPaintingIndex =
    (currentPaintingIndex - 1 + paintings.length) % paintings.length
  zoomTo(paintings[currentPaintingIndex], ZOOM_DISTANCE) // 첫 번째 줌 거리로 초기화
  zoomedPainting = paintings[currentPaintingIndex] // 줌인된 그림 업데이트
  zoomLevel = 1 // 줌 레벨 초기화
}

document.getElementById("settingsToggle").addEventListener("click", () => {
  const panel = document.getElementById("settingsPanel")
  const gear = document.getElementById("settingsToggle")
  const isOpen = panel.classList.contains("open")

  if (isOpen) {
    restoreTextureSet();
    panel.classList.remove("open")
    gear.classList.remove("moving")
  } else {
    panel.classList.add("open")
    gear.classList.add("moving")
  }
})

function zoomTo(painting, distance) {
  // distance 파라미터 추가
  if (!painting) return
  const target = painting.position.clone()
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(
    painting.quaternion,
  )
  const newCamPos = target.clone().addScaledVector(forward, distance) // distance 적용
  newCamPos.y = PAINTING_Y_OFFSET

  let camTween = { ...camera.position }
  let lookTween = { ...controls.target }
  isCameraMoving = true
  controls.enabled = false

  new TWEEN.Tween(camTween)
    .to(newCamPos, CAMERA_DURATION)
    .easing(TWEEN.Easing.Cubic.InOut)
    .onUpdate(() => {
      camera.position.set(camTween.x, camTween.y, camTween.z)
    })
    .start()

  new TWEEN.Tween(lookTween)
    .to(target, CAMERA_DURATION)
    .easing(TWEEN.Easing.Cubic.InOut)
    .onUpdate(() => {
      controls.target.set(lookTween.x, lookTween.y, lookTween.z)
      controls.update()
    })
    .onComplete(() => {
      isCameraMoving = false
      controls.enabled = true
      isZoomedIn = true
      if (document.getElementById("infoModal").style.display === "block") {
        showInfo()
      }
    })
    .start()
}

function onClick(event) {
  if (isCameraMoving) return
  raycaster.setFromCamera(pointer, camera)
  const hits = raycaster.intersectObjects(paintings)
  if (hits.length > 0) {
    const mesh = hits[0].object

    if (zoomedPainting === mesh) {
      // 이미 선택된 그림 → 더블클릭에서 처리
      return
    } else {
      currentPaintingIndex = paintings.indexOf(mesh)
      zoomTo(mesh, ZOOM_DISTANCE) // 첫 번째 줌
      zoomedPainting = mesh
      zoomLevel = 1
    }
  }
}

function onDoubleClick(event) {
  if (!zoomedPainting || isCameraMoving) return

  if (zoomLevel === 1) {
    zoomTo(zoomedPainting, ZOOM_DISTANCE_CLOSER) // 2차 줌
    zoomLevel = 2
  } else if (zoomLevel === 2) {
    zoomTo(zoomedPainting, ZOOM_DISTANCE) // 다시 1차 줌으로
    zoomLevel = 1
  }
}

function onPointerMove(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1
  raycaster.setFromCamera(pointer, camera)
  const hits = raycaster.intersectObjects(paintings)
  const canvas = renderer.domElement
  if (
    isZoomedIn &&
    hits.length > 0 &&
    hits[0].object === paintings[currentPaintingIndex]
  ) {
    canvas.classList.add("grab")
    canvas.classList.remove("hovering")
  } else if (hits.length > 0) {
    canvas.classList.add("hovering")
    canvas.classList.remove("grab")
  } else {
    canvas.classList.remove("hovering", "grab")
  }
}

function hideInstructions() {
  document.getElementById("instructionOverlay").style.display = "none"
}

function showInstructions() {
  document.getElementById("instructionOverlay").style.display = "flex"
}

document.getElementById("instructionOverlay").addEventListener("click", () => {
  document.getElementById("instructionOverlay").style.display = "none"
})

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}

function animate() {
  requestAnimationFrame(animate)
  TWEEN.update()

  // 카메라가 멀어지면 선택 해제
  if (zoomedPainting && !isCameraMoving) {
    const dist = camera.position.distanceTo(zoomedPainting.position)
    if (dist > ZOOM_DISTANCE + 1) {
      // 1 이상 멀어지면 사용자가 확실히 빠져나간 것으로 판단
      zoomedPainting = null
      zoomLevel = 0
      isZoomedIn = false
      currentPaintingIndex = -1
    }
  }

  //camera.position.x = THREE.MathUtils.clamp(camera.position.x, -ROOM_WIDTH / 2 + 1, ROOM_WIDTH / 2 - 1);
  //camera.position.y = THREE.MathUtils.clamp(camera.position.y, 0.5, ROOM_HEIGHT - 1); // 바닥 밑이나 천장 뚫는 거 방지
  //camera.position.z = THREE.MathUtils.clamp(camera.position.z, -ROOM_DEPTH / 2 + 1, ROOM_DEPTH / 2 - 1);

  controls.update()
  renderer.render(scene, camera)
}

let exhibitInfo = {
  title: "",
  startDate: null,
  endDate: null,
};

function setupExhibitSettings() {
  const titleInput = document.getElementById("exhibitTitle");
  const startInput = document.getElementById("exhibitStart");
  const endInput = document.getElementById("exhibitEnd");
  const saveBtn = document.getElementById("saveExhibitButton");

  if (!titleInput || !startInput || !endInput || !saveBtn) return;

  // 기존 저장값 로딩
  const saved = localStorage.getItem("exhibitInfo");
  if (saved) {
    const parsed = JSON.parse(saved);
    exhibitInfo = parsed;
    titleInput.value = parsed.title || "";
    startInput.value = parsed.startDate || "";
    endInput.value = parsed.endDate || "";
  }

  // 저장 버튼 클릭 시 저장
  document.getElementById("saveExhibitButton").addEventListener("click", () => {
    exhibitInfo.title = titleInput.value;
    exhibitInfo.startDate = startInput.value;
    exhibitInfo.endDate = endInput.value;

    localStorage.setItem("exhibitInfo", JSON.stringify(exhibitInfo));
    updateGalleryInfo(); // 저장버튼 클릭하면 갤러리 정보도 업데이트

    alert("테마설정이 적용되었습니다!");
  });
  updateGalleryInfo(); // setupExhibitSettings 끝날 때도 초기 갤러리 정보 업데이트

  // ****************개발 모드****************
  const isDevMode = false; // 출시할 때는 반드시 false로 바꾸기!!!!!!!!!!!!!!

}

function checkExhibitPeriod() {
  //if (isDevMode) return; // 개발 중이면 체크 스킵 ************** --> '//' 해제하기

  if (!exhibitInfo.endDate) return;

  const today = new Date();
  const end = new Date(exhibitInfo.endDate);

  if (today > end) {
    document.body.innerHTML = `
      <div style="text-align:center; margin-top:50px;">
        <h1>전시가 종료되었습니다</h1>
        <button id="resetExhibitButton" style="
          margin-top:20px; padding:10px 20px;
          background-color:#ff6666; color:white;
          font-size:18px; border:none; border-radius:20px;
          cursor:pointer;
        ">
          X
        </button>
      </div>
    `;

    // 초기화 버튼 기능 연결
    document.getElementById("resetExhibitButton").addEventListener("click", () => {
      localStorage.removeItem("exhibitInfo");
      alert("전시 설정이 초기화되었습니다! 새로고침됩니다.");
      location.reload(); // 새로고침
    });
  }
}

function updateGalleryInfo() {
  const infoDiv = document.getElementById("galleryInfo");
  if (!infoDiv) return;

  const { title, startDate, endDate } = exhibitInfo;

  if (title || (startDate && endDate)) {
    infoDiv.innerHTML = `
      <div class="title">${title || "전시명 없음"}</div>
      <div class="period">${startDate || "?"} ~ ${endDate || "?"}</div>
    `;
  } else {
    infoDiv.innerHTML = "";
  }
}

const textureSets = {
  set1: {
    floor: "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/floor/floor1.png",
    ceiling: "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/ceiling/ceiling1.png",
    walls: "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/walls/walls1.png"  
  },
  set2: {
    floor: "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/floor/floor2.png",
    ceiling: "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/ceiling/ceiling2.png",
    walls: "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/walls/walls2.png"
  },
  set3: {
    floor: "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/floor/floor3.png",
    ceiling: "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/ceiling/ceiling3.png",
    walls: "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/walls/walls3.png"
  },
  set4: {
    floor: "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/floor/floor4.png",
    ceiling: "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/ceiling/ceiling4.png",
    walls: "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/walls/walls4.png"
  },
  set5: {
    floor: "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/floor/floor5.png",
    ceiling: "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/ceiling/ceiling5.png",
    walls: "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/walls/walls5.png"
  },
  set6: {
    floor: "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/floor/floor6.png",
    ceiling: "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/ceiling/ceiling6.png",
    walls: "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/walls/walls6.png"
  },
  set7: {
    floor: "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/floor/floor7.jpg",
    ceiling: "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/ceiling/ceiling7.png",
    walls: "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/walls/walls8.png"
  },
  set8: {
    floor: "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/floor/floor8.png",
    ceiling: "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/ceiling/ceiling8.png",
    walls: "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/walls/walls9.png"
  }
};

let selectedTextureSet = null;        // 사용자가 선택한 (미리보기용)
let confirmedTextureSet = null;       // 마지막으로 저장된 값

document.querySelectorAll(".texture-option").forEach(option => {
  option.addEventListener("click", () => {
    const setName = option.getAttribute("data-set");
    selectedTextureSet = setName;
    applyPreviewTextureSet(setName); // 선택된 썸네일 배경 즉시 미리보기
    highlightSelectedOption(option); // 선택된 썸네일 시각적으로 표시
  });
});

function applyPreviewTextureSet(setName) {
  const set = textureSets[setName];
  if (!set) return;

  const floor = textureLoader.load(set.floor);
  const ceiling = textureLoader.load(set.ceiling);
  const walls = textureLoader.load(set.walls);
  updateRoomTextures(floor, ceiling, walls); // ✅ 즉시 반영
}

function applyTextureSet(setName) {
  confirmedTextureSet = setName; // ✅ 진짜 확정
  selectedTextureSet = setName;
  localStorage.setItem("selectedTextureSet", setName);
  applyPreviewTextureSet(setName);
}

function restoreTextureSet() {
  if (!confirmedTextureSet || !scene) return;
  applyPreviewTextureSet(confirmedTextureSet);
  selectedTextureSet = confirmedTextureSet;
}

function updateRoomTextures(floorTex, ceilingTex, wallTex) {
  const floor = scene.getObjectByName("floor");
  const ceiling = scene.getObjectByName("ceiling");
  const back = scene.getObjectByName("back");
  const front = scene.getObjectByName("front");
  const left = scene.getObjectByName("left");
  const right = scene.getObjectByName("right");

  if (floor) floor.material.map = floorTex;
  if (ceiling) ceiling.material.map = ceilingTex;
  if (back) back.material.map = wallTex;
  if (front) front.material.map = wallTex;
  if (left) left.material.map = wallTex;
  if (right) right.material.map = wallTex;

  // 중요! 텍스처 바꿨으면 업데이트 필요
  [floor, ceiling, back, front, left, right].forEach(mesh => {
    if (mesh) mesh.material.needsUpdate = true;
  });
}

function initApp() {
  const savedTextureSet = localStorage.getItem("selectedTextureSet");
  if (savedTextureSet) {
    confirmedTextureSet = savedTextureSet;
    selectedTextureSet = savedTextureSet;
  }

  init(); // Three.js 관련 세팅
  setupExhibitSettings();
  checkExhibitPeriod();
  updateGalleryInfo();
}

function highlightSelectedOption(selected) {
  document.querySelectorAll(".texture-option").forEach(opt => {
    opt.style.border = "2px solid transparent";
  });
  selected.style.border = "2px solid #ff8b79"; // 선택된 것 강조
}

document.getElementById("applyBackgroundButton").addEventListener("click", () => {
  if (!selectedTextureSet) {
    alert("배경을 선택하세요!");
    return;
  }

  applyTextureSet(selectedTextureSet);
  alert("배경이 적용되었습니다!")
  
  localStorage.setItem("selectedTextureSet", selectedTextureSet);

});

window.onload = initApp;

console.log(document.getElementById("settingsSlider"))
window.showPanel = function (panelId) {
  const currentActive = document.querySelector(".settings-slide.active");
  const currentId = currentActive?.id;

  // 백그라운드 → 메인으로 이동할 때만 복원
  if (currentId === "panel-background" && panelId === "panel-main") {
    restoreTextureSet();
  }

  document.querySelectorAll(".settings-slide").forEach((panel) => {
    panel.classList.remove("active")
  });
  document.getElementById(panelId).classList.add("active")
}
