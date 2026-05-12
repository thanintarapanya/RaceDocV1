# **Racedoc UI/UX & Brand Guidelines** 

## **1\. Design Philosophy & Vibe: "Precision Engineering meets Timeless Minimalism"**

* **Core Vibe:** อารมณ์เหมือนกำลังดูหน้าปัดรถสปอร์ตระดับ Hi-End (เช่น Porsche หรือ McLaren) หรือนาฬิกา Chronograph ที่ออกแบบมาอย่างประณีต ทุกอย่างต้องดูแม่นยำ (Precise) น่าเชื่อถือ (Official) และมีความเป็นมนุษย์ที่ใส่ใจในรายละเอียด (Craftsmanship)  
* **Target Audience (Gen X, Y, Z):** \* **Gen X:** ต้องการความชัดเจน อ่านง่าย ตัวหนังสือไม่เล็กเกินไป และ Contrast สูง  
  * **Gen Y:** ชอบความมีประสิทธิภาพ (Efficiency) ทำงานจบไว ข้อมูลถูกจัดเรียงเป็นระเบียบ  
  * **Gen Z:** คาดหวังความไหลลื่น (Fluidity) สวยงามแบบมินิมอล และ Micro-interactions ที่ตอบสนองทันที  
* **Aesthetic:** Clean, Uncluttered, High-contrast พื้นที่ว่าง (Whitespace) คือกุญแจสำคัญที่ทำให้ระบบดู "แพง" อย่าพยายามยัดเยียดข้อมูลทุกอย่างลงในหน้าเดียว

## **2\. Color System: "Matte Carbon & Performance Orange"**

เพื่อความ Premium เราจะใช้สีที่ให้ความรู้สึกถึงวัสดุจริงในวงการ Racing

* **Base Theme:** รองรับทั้ง Dark Mode และ Light Mode (สำคัญมากสำหรับ Gen X ที่อาจมองหน้าจอสว่างๆ ได้ชัดเจนกว่าในที่แสงจ้า)  
  * **Light Mode (เน้นเพราะจะได้สู้แสงตอนใช้งานหน้างาน):** `bg-zinc-50` (สีขาวอมเทาเล็กน้อยแบบ Titanium ไม่ใช้ขาวจัด `#FFFFFF` เพื่อลดอาการล้าของสายตา)  
  * **Dark Mode:** `bg-zinc-950` หรือ `bg-neutral-950` (หลีกเลี่ยงสี Slate ที่ติดน้ำเงิน ให้ใช้โทนเทาอมดำแบบ Matte Carbon Fiber)  
* **Primary Accent (Performance Orange):** `#FF4500` (ส้มที่เข้มและมีพลัง)  
  * **Rule:** ใช้แบบ **Ultra-Minimal** เฉพาะปุ่ม CTA หลักสุดของหน้า, Badge สถานะที่สำคัญ หรือเส้น Indicator บางๆ (1-2px) เพื่อนำสายตา ห้ามใช้เป็นพื้นหลังขนาดใหญ่เด็ดขาด  
* **Semantic Colors (Muted & Refined):**  
  * **Pass:** `text-emerald-600` / `bg-emerald-500/10` (ไม่ใช้สีเขียวสะท้อนแสง)  
  * **Warning:** `text-amber-600` / `bg-amber-500/10`  
  * **Fail/Danger:** `text-red-600` / `bg-red-500/10`  
* **Surface/Cards:** ใช้เทคนิค "Flat with Subtle Borders" ขอบการ์ดใช้สี `border-zinc-800` (Dark) หรือ `border-zinc-200` (Light) ไม่มี Drop Shadow หรือเงาฟุ้งๆ เด็ดขาด

## 

## **3\. Typography: "The Structural Foundation"**

ฟอนต์คือสิ่งที่แยกงาน AI/Template ดาดๆ ออกจากงาน Premium

* **Primary Font (UI & Prose):** `Geist` หรือ `Inter`  
  * **Rule for Multi-Gen:** กำหนด Base Size ที่ `16px` (ไม่ใช้ 14px เป็นหลัก เพื่อให้ Gen X อ่านง่าย) ใช้การเล่นน้ำหนัก (Font Weight) เพื่อแบ่งลำดับข้อมูล เช่น **Medium (500)** สำหรับ Label และ **Regular (400)** สำหรับ Data  
* **Monospace Font (Racing Data):** `Geist Mono`  
  * **Rule:** ตัวเลขที่เป็น Data สำคัญ (Lap Time, Weight, Telemetry, Seal Number) **ต้อง** เป็น Monospace เสมอ เพื่อให้ตัวเลขเรียงตรงกันทุกบรรทัด (Tabular figures) ดูมีความเป็น "เครื่องมือวัดผลแบบมืออาชีพ"

## **4\. UI Library & Components: "Intuitive & Accessible"**

* **Framework:** `shadcn/ui` \+ `Tailwind CSS`  
* **Component Styling:**  
  * **Buttons:** ทรงสี่เหลี่ยมมุมโค้งมนเล็กน้อย (Radius `0.25rem` หรือ `0.375rem`) ให้ความรู้สึกถึงความเป็นฮาร์ดแวร์ กดง่าย พื้นที่สัมผัสกว้างพอสำหรับนิ้วมือบนมือถือ (Fitts's Law \- ขั้นต่ำ 44x44px)  
  * **Forms:** ใช้ Label อยู่ด้านบน Input เสมอ (Top-aligned labels) เพื่อให้อ่านง่ายที่สุด ไม่ต้องกวาดสายตาซ้ายขวา ลด Cognitive Load  
  * **Data Tables:** ดีไซน์แบบ Editorial ลบเส้นขอบแนวตั้งทิ้งทั้งหมด ใช้เส้นคั่นแนวนอน (Horizontal Dividers) สีอ่อนๆ และมี Hover State ที่แถว (Row) เป็นสีเทาบางๆ เพื่อให้ตามองตามข้อมูลได้ง่าย

## **5\. Micro-Animations & Interactions: "The Tactile Feedback"**

* **Library:** `framer-motion`  
* **Rules for Animation:**  
  * ความเร็วต้อง "Snappy" (0.1s \- 0.2s) ไม่มี Ease-out ที่ยืดยาด ระบบแอดมินต้องตอบสนองทันใจผู้ใช้งาน  
  * **Tactile Feel:** เมื่อกดปุ่ม ควรมีการยุบตัวลงเล็กน้อย (`scale: 0.98` หรือ `0.97`) เพื่อให้ความรู้สึกเหมือนกำลังกดสวิตช์จริงๆ (Physical feedback)  
  * **Skeleton Loaders:** ใช้แทน Spinner เมื่อดึงข้อมูล เพื่อให้ UI ดูมีโครงสร้างและโหลดเร็วขึ้นในความรู้สึก

## 

## 

## **6\. The "Bespoke / Anti-AI" Constraints (ข้อห้ามเด็ดขาด)**

* **NO Gradients & NO Glows:** ห้ามใช้เกรเดียนต์สีสดใส หรือเอฟเฟกต์เรืองแสงแบบ Sci-Fi/Web3 งาน Racing ที่ดูแพงคือความ Solid และ Matte  
* **NO Generic Empty States:** หน้าจอที่ไม่มีข้อมูล ห้ามใช้ภาพประกอบ (Illustrations) สำเร็จรูป หรือรูปกล่องกระดาษ ให้ใช้ Icon Monoline เรียบๆ และ Text ที่บอกว่าต้องทำอะไรต่อ (เช่น "No penalties recorded. Click 'Add Penalty' to flag an issue.")  
* **NO Hidden Actions:** ฟังก์ชันที่ต้องใช้บ่อย (เช่น การกด Approve, การ Edit) ห้ามซ่อนอยู่ในเมนูสามจุด (`...`) ให้โชว์เป็นปุ่ม Icon เรียบๆ ไว้ที่บรรทัดนั้นเลย เพื่อให้ Gen X และ Y ทำงานได้เร็วที่สุด  
* **Strict Alignment:** จัดวางเลย์เอาต์แบบ Grid (ซ้าย-ขวา ชัดเจน) ห้าม Center-align ข้อมูลฟอร์มหรือตารางเด็ดขาด เพราะการจัดแบบชิดซ้าย (Left-aligned) คือรูปแบบที่ตาคนเราสแกนข้อมูลได้เร็วและเป็นธรรมชาติที่สุด (F-Pattern)

