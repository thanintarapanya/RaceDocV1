# **Architecture (PRD)**

# **Product Requirements Document (PRD)**

**Project Name:** RacedocV1 (Digital Racing Document Management System)

**Document Version:** Enterprise Architecture Update

**Target Event:** PT MAXNITRON RACING SERIES (SIAM Series, ISUZU Challenge) and can be used by other organizer

## ---

**1\. Executive Summary & Product Vision**

**Racedoc** คือแพลตฟอร์มบริหารจัดการเอกสารและข้อมูลการแข่งขันรถยนต์ทางเรียบระดับมืออาชีพ สร้างขึ้นเพื่อทดแทนกระบวนการทำงานแบบกระดาษ (Paperless) ลดข้อผิดพลาดในการตรวจสอบหน้างาน (Human Error) และเพิ่มความโปร่งใสในระบบ Audit กฎกติกา

**เป้าหมายหลัก (Core Objectives):**

* **Single Source of Truth:** ระบบเดียวที่รวบรวมข้อมูลตั้งแต่นักแข่งสมัคร (Entry Form), ตรวจสภาพรถ (Scrutineering), ชั่งน้ำหนัก (Weigh-in), การถ่วงน้ำหนัง (SuccessBallast), การนับคะแนนและการประกาศคะแนน (Race Result)ไปจนถึงการยื่นคำร้อง (Competitor Request)  
* **Dynamic Rule Engine:** กติกาการแข่งขันสามารถปรับเปลี่ยนได้ทุกEvent โดย Admin โดยที่ฐานข้อมูลไม่พังรวมถึงข้อมูลเก่าที่กติกาไม่ได้เหมือนกับการตั้งค่าปัจจุบันก็ไม่หายและไม่ต้องรื้อโค้ดเขียนใหม่   
  โดย 1 Season \= หลาย Event (ตอนนี้มี3Events), 1 Event \= หลาย Race (ตอนนี้ Event1=3Races, Event2=2Races, Event3=2races)  
* **Enterprise-Grade Security:** แยกสิทธิ์การเข้าถึงและการแก้ไขเอกสาร (RBAC) อย่างเด็ดขาด ป้องกันการสวมรอยหรือแก้ไขข้อมูลโดยไม่ได้รับอนุญาต และที่สำคัญมีระบบ Audit Trail ที่ตรวจสอบได้ทุก Actions  
* **Responsive :** Responsive on All Devices  
* **Primary-Thai Language:** จะใช้ภาษาไทยเป็นหลักและเปลี่ยนเป็น English Language ได้ แต่ในหัวข้อ Input Form ต่างๆจะเป็น “ไทย/English”.

## ---

## 

## 

## 

## **2\. System Architecture & Tech Stack**

เพื่อรองรับการสเกลและการใช้ AI Agent พัฒนาระบบ เราจะใช้สถาปัตยกรรมดังนี้:

* **Frontend:** React.js (Vite)  
* **CSS Framework:**  Tailwind CSS, Framer Motion, shadcn/ui  
* **Backend Management Platform:** Supabase จัดการ Back-end ทุกอย่างให้เลยผมไม่ใช่ Programmer เพราะฉนั้นผมจะทำแค่Front-endแล้วให้ Supabase จัดการหลังบ้านทั้งหมด (เชื่อม Opencode กับ Supabase ผ่าน MCP)  
* **Hosting:** Local on Premise  
* **Notification:** Library for email notification.  
* **Implement Approach:**  
  *  Implement Tab by Tab.   
  * **\*\*กูไม่จัดการ backend เองนะ ให้ Supabase จัดการทั้งหมด กูทำแค่ Front-end และบอกความต้องการความสัมพันธ์ของข้อมูลเท่านั้น\*\***  
  * **\*\*ไฟล์ทั้งหมดเก็บบน server ของกูเอง\*\***  
  * **\*\*Best Practice Code Structure (Easy for hand-off project and maintenance)\*\***  
* **Design System:** ทำให้ สี, Font, สีตัวหนังสือ, สามารถ White Label ได้ง่ายๆโดยเปลี่ยนแค่ใน Design system แล้วทั้ง Web-app จะเปลี่ยนตาม เผื่อในอนาคตจะให้ organizer อื่นๆใช้จะได้ปรับสีให้เข้ากับ Brand เค้า  
* **\*\* เป็น Web-App ไม่ใช่ Mobile Application\*\***  
* **\*\* All Pages Responsive on All Devices \*\***

## ---

## 

## 

## 

## 

## 

## 

## 

## 

## 

## 

## **3\. User Roles & Access Control (RBAC) \- Detailed Specification**

ระบบ Racedoc ใช้โครงสร้างการควบคุมสิทธิ์แบบเข้มงวด (Strict RBAC) โดยสิทธิ์ในการมองเห็น (View) และการกระทำ (Action) จะถูกควบคุมผ่าน Server-side Logic 100% ทุก Action ในระบบจะมีการบันทึก **Audit Trail** (created\_by\_id, updated\_by\_id, timestamp) เสมอ 

\- ตอน SignUp สามารถเลือกได้ว่าตัวเองเป็น Competitor หรือ Team manager ไม่สามารถเลือก Role อื่นได้  
\- Admin สามารถที่จะเชิญคนอื่นๆเข้ามาเป็น Role อะไรก็ได้  
\- Admin สามารถที่จะ Manage User\&Role ได้ผ่านหน้า UI ได้เลยจะได้ไม่ต้องคอยติดต่อDeveloper ตลอด แต่อยากให้ระบบดำเนินการอย่างปลอดภัย

### **3.1 Role Definitions & Permission Matrix**

| Role | Description & Core Responsibility | Key Permissions (CUD: Create, Update, Delete) | Read-Only Access |
| :---- | :---- | :---- | :---- |
| **Admin** | ผู้ดูแลระบบสูงสุด | **Full Control:** สามารถจัดการได้ทุกระบบ, แก้ไขกติกา (Dynamic Rules), จัดการ User/Role, กู้คืนข้อมูล (Recently Delete) | ทุกส่วนของระบบ |
| **Secretary** (เลขาธิการสนาม) | ศูนย์กลางการจัดการเอกสารและตรวจสอบคุณสมบัติ | **Primary:** อนุมัติ/ปฏิเสธ Entry Form, จัดการ Candidate Checklist ทุกขั้นตอน, คัดกรองและส่งต่อใบคำร้อง (Request Pipeline) | Inspection, Weight-in, Race Result, Scrutineer Report |
| **Head Scrutineer** | หัวหน้าทีมตรวจสภาพรถ | **Primary:** ตรวจสภาพ (Inspection), จัดการหมายเลขซีล (Components), ชั่งน้ำหนัก (Weight-in), ออกรายงาน Scrutineer Report, **ตัดสินใบคำร้อง (CompetitorRequest )หาก Secretary ส่งมาให้ Approve  (Request Approval)** | Entry Form, Race Result, Checklist |
| **Scrutineer Staff** | เจ้าหน้าที่ตรวจสภาพหน้างาน | **Operational:** ตรวจสภาพ (Inspection), จัดการหมายเลขซีล (Components), ชั่งน้ำหนัก (Weight-in) **\*\*ห้ามติ๊ก Off-site inspected\*\*** |  Entry, Race Result, Scrutineer Report, Checklist, Competitor Request |
| **Off-Site Scrutineer Staff** | เจ้าหน้าที่ตรวจสภาพนอกสถานที่ | **Specialized:** จัดการหมายเลขซีล (Components) และ **มีสิทธิ์ติ๊ก Checkbox "Off-site Inspected"** | ข้อมูล Components ของรถทุกคัน, Entry Form ของรถทุกคัน, Race Result, Scrutineer Report |
| **President** | ประธาน | **Authority:** ตัดสิน Approve/Reject ใบคำร้อง (Compotitor Request) ที่ Secretary ส่งมาให้ช่วยพิจารณา | ทุกระบบ (Read-only) เพื่อใช้ประกอบการตัดสินใจ |
| **Steward** | กรรมการผู้ตัดสิน | **Authority:** ตัดสิน Approve/Reject ใบคำร้อง (Compotitor Request) ที่ Secretary ส่งมาให้ชาวยพิจารณา | ทุกระบบ (Read-only) เพื่อใช้ประกอบการตัดสินใจ |
| **Clerk of the course** | นายสนาม | **Authority:** ตัดสิน Approve/Reject ใบคำร้อง (Compotitor Request) ที่ Secretary ส่งมาให้ช่วยพิจารณา | ทุกระบบ (Read-only) เพื่อใช้ประกอบการตัดสินใจ |
| **Team Manager** | ผู้จัดการทีม (ผู้ดูแลนักแข่งหลายคน) | **Delegated:** จัดการทุกอย่างที่นักแข่ง(competitor)สามารถทำได้**แทนนักแข่งทุกคนที่ได้ทำการยินยอม** |  Inspection Formของนักแข่งในทีมตนเองเท่านั้น, Weight-in ของนักแข่งในทีมตนเองเท่านั้น, Checklist ของนักแข่งในทีมตัวเองเท่านั้น, Race Result ของทุกคัน |
| **Competitor** | นักแข่ง (เจ้าของ License) | จัดการ Entry Form และ Request ของรถตัวเอง, ตรวจสอบผลลัพธ์ของตัวเอง, เขียนใบตรวจสภาพบางส่วน |  Inspection Formของตนเองเท่านั้น, Weight-in ของตนเองเท่านั้น, Checklist ของตัวเองเท่านั้น, Race Result ของทุกคัน |

### 

###  

### 

### 

### 

### **3.2 Detailed Functional Access Control (Access Logic)**

#### **1\. ระบบจัดการความสัมพันธ์ (Relationship Logic)**

* **Team Manager:** จะไม่เห็นข้อมูลและกระทำการใดๆแทนนักแข่งในสังกัดได้ จนกว่าจะมีนักแข่ง (Competitor) กด Accept คำเชิญ โดยTeam manager จะเป็นผู้เริ่มส่งคำเชิญเข้าร่วมทีมแล้วนักแข่งตอบรับ หรือCompetitor ส่งคำขอให้มาเป็น Team manager ของตนเอง   
* **Competitor:** เป็นเจ้าของสิทธิ์ (Owner) สามารถถอนสิทธิ์ (Revoke) Manager ได้ทุกเมื่อ

#### **2\. ระบบใบสมัคร (Entry Form Workflow)**

* **Competitor/ Team Manager:** กรอกข้อมูลสมัครเข้าร่วมการแข่งขันใน Entry Form ระบบ Auto-save และจะขึ้นเป็น Draft ไว้ แต่หากกด Submit จะมีข้อความเพิ่ม Confirm อีกครั้งว่าถ้าส่งแล้วจะแก้ไขไม่ได้ ถ้ากด Confirm สถานะของ Entry Form นั้นจะกลายเป็น Pending เพื่อรอ Secretary/Admin เข้ามากด Approve สถานะก็จะกลายเป็น Active and Locked  
* **Locking Mechanism:** เมื่อ Secretary กด "Approved" ข้อมูล Entry Form จะถูกเปลี่ยนเป็นสถานะ **Active** และ **Locked** (ห้าม Competitor/Team Manager แก้ไขเอง) และจะใช้ข้อมูลที่ Active และ Locked  เป็น Live Snap Short ไปใช้ในส่วนอื่นๆ หากนักแข่งหรือ Team manager ต้องการแก้ไขจำเป็นต้องส่งคำร้อง (Competitor Request) เท่านั้น  
* **Secretary/Admin Control:** เป็นสอง Roles ที่สามารถปลดล็อคหรือแก้ไขข้อมูลใน Entry Form หลังจาก Approved ได้ (ในกรณีที่มีความจำเป็น)
* **Race Eligibility Cache:** Entry Form จะมีค่า `is_eligible_to_race` เพื่อบอกว่ารถคันนี้มีสิทธิ์ลงสนามหรือไม่ โดยค่าเริ่มต้นต้องเป็น `false` และห้าม Frontend เป็นคนอัปเดตค่านี้เอง ค่า `is_eligible_to_race` ต้องถูกอัปเดตโดย PostgreSQL Trigger จากสถานะของ Inspection Form เท่านั้น: ถ้า Inspection Form เป็น `Passed` ให้เป็น `true`; สถานะอื่นทั้งหมด เช่น `Draft`, `Pending`, `Hold`, `Failed` ต้องเป็น `false` เสมอ เพื่อป้องกันรถที่ถูก Hold/Failed หลุดลงสนาม

#### **3\. ระบบตรวจสภาพและอะไหล่ (Scrutineering & Components)**

* **Staff Constraint:** Scrutineer Staff ปกติจะไม่สามารถบันทึกรายการที่เป็น "Off-site Inspected" ได้ เพื่อป้องกันการทุจริตหน้างาน ต้องเป็น Role **Off-Site Scrutineer** เท่านั้น  
* **Head Scrutineer Exclusive:** เป็นผู้เดียวที่สามารถออก **Scrutineering Report (สรุปผลตรวจสภาพ)** ประจำ Race ได้

#### **4\. ระบบใบคำร้อง (Request Pipeline)**

นี่คือระบบที่มีลำดับการเข้าถึง (Pipeline):

* **Draft/Submit:** ทำโดย Competitor หรือ Team Manager  
* **Screening:** Secretary ตรวจสอบความถูกต้อง และสามารถเลือกกรรมการที่เกี่ยวข้องเพื่อส่งคำร้องนี้ให้มาช่วยพิจารณา Approve/Reject พร้อมลง Comment  
* **Final Decision:**  
  * **Secretary** จะเป็นคนพิจารณา Approve/Reject และลง comment  ด่านสุดท้ายพร้อม กรอกค่าปรับ (หากมี) หรือ ถ่วงน้ำหนักเพิ่ม(หากมี)ซึ่งต้องนำไปคำนวณค่า Target Weight ด้วย  
* *หมายเหตุ: ทุก Role ในท่อการตัดสินใจสามารถดูประวัติ (Audit Trail) ของ Request นั้นๆ ได้ว่าใครเป็นคนส่งและ Secretary มีความเห็นว่าอย่างไร ใครเป็นคนช่วยพิจารณาและลง Approve/Reject ตอนเวลาเท่าไหร*

### ---

### 

### **3.3 Security & Audit Constraints**

* **Strict Filtering:** ทุก API Query ต้องมีการใส่ Filter userId หรือ teamId เสมอ ห้ามดึงข้อมูลแบบ Global เว้นแต่เป็น Role Admin หรือ Secretary  
* **Audit Logs:** ทุกครั้งที่มีการเปลี่ยนแปลงสถานะ (Status Change) ระบบต้องบันทึก previous\_status, new\_status, action\_by ลงในตาราง audit\_logs  
* **UI Adaptability:** \* ปุ่ม "Approve" จะแสดงผลเฉพาะในหน้าจอของ Secretary, Head Scrutineer และ Steward ตามประเภทของคำร้อง  
  * Checkbox "Off-site Inspected" ในหน้า Components จะถูก disabled สำหรับ Scrutineer Staff ปกติ

## ---

**4\. User Journey workflow** 

\*\* Responsive on all devices

### **4.1 Main menu**

- Dashboard Tab: สำหรับแสดงข้อมูลที่สำคัญของ Role นั้นๆโดยแต่ละ Role จะเห็นข้อมูลไม่เหมือนกันเช่น Competitor และ Team Manager จะเห็นยอดรวมของ Pending Request, Approved Request, Target Weight ใน Race หน้า, คะแนนการแข่งขันรวมจนถึงปัจจุบัน, Etc   
  รวมถึง Dashboard จะมี Alert/Notify Section ที่จะบอกว่าตอนนี้มี Activity สำหรับ Role ตัวเองว่าอะไรเกิดขึ้นบ้างเช่น ใน Role Competitor: Secretary Approved your request, etc  นอกจากนี้จะมีปุ่มสำหรับ Onboard คนที่สมัครเข้ามาใหม่ และมีปุ่มลัดให้กดเพื่อความสะดวก  
    
- Entry Form Tab: สำหรับแสดง List ของ Entry Form ที่ตัวเองหรือ Team manager ได้สร้างไว้ โดยจะมี 5 สถานะ Draft, Pending, Active, Inactive, Rejected นอกจากนี้ยังมีปุ่มให้กด สร้าง Entry Form ใหม่ด้วย โดย 1 Account จะมีได้แค่ 1 Active Entry Form ต่อ 1 Event.  
    
- Checklist Tab: สำหรับแสดง List ของนักแข่งที่ Entry Form มีสถานะ Active แล้วเพื่อให้ Secretary สามารถติ๊ก Check box เพื่อเช็คชื่อ รวมถึงเช็ค Topic อื่นๆหากต้องการเช่น รับสติกเกอร์รึยัง, จ่ายตังรึยัง, etc  
    
- Inspection Form Tab: สำหรับแสดง List ของ Inspection Form ของนักแข่งที่มีสถานะ Entry Form เป็น Active และมีปุ่มสร้าง Inspection Form ใหม่หากนักแข่งไม่เคยสร้างมาก่อนใน Event นั้นๆ โดย Inspection Form จะมี 5 สถานะ Draft (ยังไม่กด Submit Form), Pending, Passed,Hold, Failed. โดย 1 Account จะมีได้แค่ 1 Active Entry Form ต่อ 1 Event.  
    
- Weight-In Tab: สำหรับแสดง List ของนักแข่งทุกคนที่ Entry Form เป็น Active โดยจะแสดงค่าTarget Weight และช่องสำหรับใส่ค่า Actual Weight หากน้ำหนักต่ำกว่าก็จะเป็น Failed หนักเท่าหรือมากกว่า Target weight จะ Passed  
- Racing Result Tab: สำหรับแสดง ตารางคะแนนการแข่งขันทุก Race ทุก Series ใน Season นั้น พร้อมแสดง น้ำหนัก SuccessBallast   
- Scrutineer Report Tab: สำหรับแสดง List ของ Scrutineer Report ของแต่ละ Series และแต่ละ Race และสามารถกดปุ่มสร้าง Scrutineer report อันใหม่ได้  
- Competitor Request Tab: สำหรับแสดง List คำร้องของตัวเองและสามารถสร้าง Request ใหม่ของตัวเองได้  
- Recently Delete Tab (Only Admin): สำหรับแสดง List Form ที่ Admin กดDelete เช่น Entry Form, Competitor Request Form, Scrutineer Form แล้วต้องการที่จะกู้คืน โดยจะมีเวลา 30 วันก่อนลบจริง   
- Setting   
  - Profile: สำหรับแสดงและแก้ไขข้อมูล Profile Account และ Role ของตนเอง  
  - Privacy: สำหรับแสดงและแก้ไขข้อมูล Password ของตัวเอง  
  - User & Role : สำหรับ Admin ในการจัดการผู้ใช้งานทั้งหมดรวมถึงส่งคำเชิญRoleต่างๆ  
  - Organizer setting: สำหรับ Admin ในการตั้งค่า Season, Event, Race, Series Race,กฏ, กติการ ต่างๆ  
    - Season :สำหรับแสดง list ของ Season โดย Admin สามารถสร้าง,ตั้งค่าว่า Season นี้มี Series Race อะไรบ้างและแต่ละ Series มีGrade อะไรบ้างและสามารถจัดการ Season ได้  
      - Event: สำหรับแสดง List ของ Event โดย Admin สามารถสร้างและจัดการ Event ได้รวมถึงตั้งค่า ได้ว่าแต่ละ Event แข่งที่สนามไหนได้และกำหนด Event Rule ของ Event นั้นๆได้  
        - Race: สำหรับแสดง List ของ Race โดย Admin สามารถสร้างและจัดการ Race ได้   
        - Event Rule: กำหนด กฏ, กติกา, รูปแบบฟอร์มต่างๆ  
          - Inspection Form Builder: สำหรับสร้าง Inspection Form ของแต่ละ Series Race สำหรับ Event นั้นๆ เพราะ Form จะต่างกัน  
            - Form Section: สำหรับตั้งค่า Form    
            - Weight Section: สำหรับตั้งค่า (พิกัดน้ำหนักตามความจุเครื่อง) Base weight และ Additional Weight (น้ำหนักเพิ่มเติมจากอุปกรณ์แต่งเสริม)  
          - Success Ballast: สำหรับตั้งค่าน้ำหนักถ่วงของแต่ละ Series Race ว่าใช้การถ่วงน้ำหนักแบบไหนและที่ 1,2,3 จะต้องถ่วงน้ำหนักเท่าไหร  
          - Tire: สำหรับ Admin กำหนดBrandยางของแต่ละ Series Race ว่าใน Event นี้นักแข่งใช้ Brand อะไรได้บ้าง  
          - Sponsor Sticker: สำหรับ Admin อัพโหลด Sponsor Sticker ของแต่ละ Series Race ใน Event นั้นๆ  
          - A4 Backgound: สำหรับ Admin อัพโหลดรูปเพื่อใช้เป็นพื้นหลังในการ Export PDF

### **4.2 Account & Onboarding Flow**

* **Account Registration:** ลงทะเบียนบัญชีใหม่ผ่านอีเมลหรือGoogle โดยต้องเลือก Role ระหว่าง competitor หรือ Team Manager ก่อน ส่วน Role อื่นๆจะต้องถูก Invited เท่านั้น และมีระบบ Forget Password, Change Password  
* **First Page After First Login:** Login ผ่าน Email หรือ Google ได้ หน้าแรกเมื่อ Login เข้ามาจะต้องตั้งค่า Profile ก่อน ทั้งชื่อ,นามสกุลภาษาไทย,เบอร์,บัตรประชาชน/Passport,วันเกิด,กรุ๊ปเลือก, สัญชาติ  ถ้าเป็น Team Manager ต้องกรอก Profile เหมือนกัน และจะต้องสร้าง Team Info ก่อน ตอนกรอก Entry Form จะดึงข้อมูลทีมนี้เข้าไปกรอกอัตโนมัติ  
* **First Entry Form:** หลังจากตั้งค่า Profile เสร็จก็จะเด่งไปที่ Entry Form Tab หน้าต่างแสดงแบบ List Table หากยังไม่มีรายการ Entry Form ระบบจะบังคับ (Call to Action) ให้สร้าง Entry Form ใบแรก เมื่อ Login ครั้งแรกมาแล้วถ้าเป็น Competitor จะมีให้เลือกระหว่าง Create Entry form by myself, Let my manager do it for me (add Manager by adding the manager account email then waiting for Manager accept) ถ้าเป็น Team Manager จะมีปุ่ม Call To Action บังคับให้กด ปุ่ม Add Competitor (Can Request Adding Competitor by adding the Competitor account email then waiting for Competitor accept). สำหรับ Teammanager ถ้าไม่มีใคร Accept จะยังไม่สามารถเห็น/จัดการอะไรอย่างอื่นได้เลย  
  * **Revocation:** นักแข่งสามารถเพิกถอนสิทธิ์ (Revoke) ของ Team Manager ได้ทันทีผ่าน Dashboard ของตนเอง  
  * **Audit Trail:** ระบบต้องบันทึก `created_by_id` และ `updated_by_id` ในทุกเอกสาร เพื่อระบุตัวตนผู้กระทำรายการจริง (นักแข่ง หรือ ผู้จัดการทีม) ในกรณีที่เกิดข้อพิพาท  
* ถ้าเป็น Competitor/Team manager จะมองเห็นแค่ List Entry ของตัวเองหรือนักแข่งในสังกัดตัวเอง

แต่ถ้าเป็น Role อื่นๆจะสามารถเห็น List Entry Form ของนักแข่งทุกคนได้

* มี Filter ตาม Year, Event, Series Race, Class  
* หน้า List นี้สามารถ Export PDF เพื่อปริ้นเป็นขนาด A4 ได้

### **4.3 Entry Form Tab(เจาะลึกระบบใบสมัครแข่งขัน)**

**Entry Form** คือ "Digital Passport" ของรถแข่งแต่ละคันในแต่ละ Event ข้อมูลจากส่วนนี้จะถูกใช้เป็นฐานข้อมูลหลัก (Master Data) ให้กับระบบตรวจสภาพ (Inspection) และการชั่งน้ำหนัก (Weight-in) รวมถึงการส่งใบคำร้อง

#### **4.3.1. Lifecycle & States (สถานะของใบสมัคร)**

* มี List Entry Form แสดงอยู่  
* มี Filter ตาม Year, Event, Series Race, Class

ใบสมัครจะมีสถานะที่ถูกควบคุมโดยระบบและสิทธิ์ของ User ดังนี้:

* **Draft (ร่าง):** ผู้ใช้บันทึกข้อมูลไว้ แต่ยังกรอกไม่ครบ หรือยังไม่พร้อมส่ง (แก้ไขได้ตลอด)  
* **Pending (รอตรวจสอบ):** ผู้ใช้กด Submit แล้ว ข้อมูลจะถูกล็อคชั่วคราวเพื่อรอ Secretary ตรวจสอบ  
* **Active (อนุมัติแล้ว):** Secretary ตรวจเอกสารและกด Approved ข้อมูลจะถูก `is_locked: true` ทันที  
* **Rejected (ถูกปฏิเสธ):** Secretary พบข้อผิดพลาดและส่งกลับ ข้อมูลจะกลับไปแก้ได้พร้อมระบุเหตุผล  
* **Inactive (สิ้นสุด/ยกเลิก):** เมื่อจบการแข่งขัน หรือรถคันนั้นถูกถอนตัวจากการแข่งขัน  
  ---

  #### **4.3.2. The 5-Step Entry Workflow (กระบวนการกรอกฟอร์ม)**

เมื่อกดปุ่ม Create Entry Form จะมี window Popup เป็น Progressive Form 

Step 1: Event & Class Selection (การเลือกงานแข่งและรุ่น) (Required)

* **Multi-Select:** ผู้ใช้สามารถเลือก Event ที่ต้องการสมัคร (เช่น เลือก Event 1, 2 และ 3 พร้อมกัน) โดยระบบจะดึงข้อมูล Event ที่ Admin Setting ไว้  
* **Default:** ระบบจะติ๊กเลือกทุก Event ในฤดูกาลไว้ให้เป็นค่าเริ่มต้น  
* **Circuit Linked:** ในแต่ละ Event จะล็อคสนามไว้อยู่แล้วเช่น เลือก Event 1,2 \=สนาม Chang International Circuit เลือก Event 3 \= สนาม PT Songkhla Street Circuit ตามที่ Admin ได้ตั้งค่าไว้  
* **Data Injection:** ระบบดึงจำนวน Event ที่มีทั้งSeason นั้นมาเป็นตัวเลือก รวมถึงชื่อสนามในแต่ละ Event ,รายชื่อ "รุ่นการแข่งขัน (Series)" และ "เกรด (Grade)"   
* `Question:`   
  * `รุ่นการแข่งขัน / Series Race`   
  * `ระดับที่ลงแข่ง / Grade Race`  
  * `หมายเลขรถ / Car Number`  
  * `งานแข่งขัน / Event (เลือก Event ที่จะแข่งขัน)`  
  * `ปีการแข่งขัน (ระบบจะล็อคเป็นปี Saeson ปัจจุบันตลอด)`

  #### **Step 2: Personal & Team Information (ข้อมูลบุคคลและทีม) (Required)**

* **Identity Sync:** หากเป็น Competitor กรอกเอง ระบบจะดึงชื่อ,นามสกุล,เบอร์โทร, เลขบัตรประชาชน/Passport จาก Profile มาใส่ให้อัตโนมัติ  
* **License Info:** บังคับกรอกหมายเลขใบอนุญาตขับแข่ง (Competition License No.)  
* `Question:`   
  * `ชื่อ (ภาษาไทย) / Name (Thai)`  
  * `นามสกุล (ภาษาไทย) / Surname (Thai)`  
  * `ชื่อ (ภาษาอังกฤษ) / Name (English)`  
  * `นามสกุล (ภาษาอังกฤษ) / Surname (English)`  
  * `วัน/เดือน/ปีเกิด / Date of Birth :Date Picker`  
  * `กรุ๊ปเลือด / Blood Type :Dropdown choose one option`  
  * `สัญชาติ / Nationality`  
  * `เลขที่บัตรประชาชน / พาสปอร์ต / I.D.CARD NO. / PASSPORT NO.`  
  * `ที่อยู่ปัจจุบัน / Address`  
  * `รหัสไปรษณีย์ / Postcode`  
  * `อีเมล / Email`  
  * `เบอร์โทรศัพท์ / Mobile No.`  
  * `ไอดีไลน์ / ID Line`  
  * `อินสตาแกรม / Instagram / IG`  
  * `เฟซบุ๊ก / Facebook`  
  * `ยูทูป / Youtube`  
  * `ติ๊กต๊อก / Tiktok`

  #### **Step 3: Vehicle Technical Details (ข้อมูลทางเทคนิคของรถ)**

* **Team Selection:** เลือกสังกัดทีม (หากมี Manager ระบบจะเลือกชื่อทีมที่ผูกสัมพันธ์ไว้)  
* `Question:`   
  * `Driver License (Required)`  
    * `เลขที่ใบอนุญาตขับแข่ง / Competition License No.`  
    * `ระดับตามใบอนุญาตขับแข่ง / Categorization Grade`  
    * `ออกโดย / Issued By`  
    * `วันออกใบอนุญาต / Date of Issued`  
    * `วันหมดอายุใบอนุญาต / Expiry Date :Date Picker`  
  * `Car Info (Required)`  
    * `ยี่ห้อรถ / Car Manufacturer`  
    * `รุ่น / Model`  
    * `สี / Color`  
    * `ปี / Year`  
    * `ขนาดความจุเครื่องยนต์ / Engine Size (CC.)`  
    * `รหัสเครื่องยนต์ / Engine Code`  
  * `Team Info (ถ้ามี Invited Team Manager แล้วจะดึงข้อมูลนั้นมากรอกให้อัตโนมัติ ถ้าไม่มีจะต้องกรอกเอง)`  
    * `ชื่อทีมแข่ง / Team Name`  
    * `ชื่อ-สกุล ผู้จัดการทีม / Team Manager's Name`  
    * `เบอร์โทรศัพท์มือถือผู้จัดการทีม / Manager Mobile No.`  
    * `ความต้องการใช้พื้นที่ pit ร่วมกับทีมใด / Require together for pit area`  
    * `ที่อยู่ในการจัดส่งเอกสาร / Address for send document`  
    * `รหัสไปรษณีย์ / Postcode`  
    * `เบอร์โทรศัพท์ / Mobile No.`

  #### **Step 4: Document Uploads (การอัปโหลดหลักฐาน)**

* **File Types:** บังคับอัปโหลดเอกสารรับรอง  
* **Mobile Optimized:** รองรับการกดปุ่มแล้วเปิดกล้องบน iPad/Mobile เพื่อถ่ายรูปและอัปโหลดทันที  
* `Required Document:`   
  * `รูปถ่ายนักแข่ง (สวมชุดแข่ง) ขนาดไฟล์ไม่ตํ่ากว่า 1MB / Driver's Photo (Wear A Racing Suit) File Size not less than 1 MB.`  
  * `สําเนาบัตรประชาชน จํานวน 1 ใบ/ A Copy of ID.Card or A Copy of Passport 1 Piece.`  
  * `ใบรับรองแพทย์ / Medical Certificate`  
  * `สําเนาใบอนุญาตขับแข่ง จํานวน 1 ใบ / A Copy of Driver's License 1 Piece.`  
  * `หลักฐานการชําระค่าสมัคร / Slip for payment`  
  * `สําเนาสมุดบัญชี จํานวน 1 ใบ / A copy of book bank 1 Piece.(ใช้สําหรับโอนเงินรางวัลให้กับผู้ที่ได้รับรางวัล / Used for transfer prizes to those who have a prizes.)`  
  * `เอกสารอื่นๆ (ถ้ามี) / Other Document (if any)`

  #### 

  #### 

  #### 

  #### **Step 5: Legal Consent & Digital Signature (การยินยอมและลงนาม)**

* **Terms & Conditions:** จะต้องแสดงข้อตกลงการแข่งขันด้านล่างนี้ (Sporting Regulation)  
  ข้าพเจ้าจะไม่เรียกร้องค่าเสียหายอันเกิดจากอุบัติเหตุในการแข่งขัน และยินยอมเป็นผู้รับผิดชอบเอง ในความเสียหายแทนผู้จัดการแข่งขันและ  
  คณะกรรมการที่ดําเนินการแข่งขันทุกๆ ฝ่ าย รวมไปถึงเจ้าของสนามผู้อุปถัมภ์จัดการแข่งขัน ผู้บริจาคเงินเพื่อการแข่งขันตลอดจนเจ้าหน้าที่ต่างๆ บริวารผู้  
  แทนและตัวแทนนิติบุคคล ดังกล่าวในกรณีที่มี การดําเนินคดี การเรียกร้องค่าตอบแทน ค่าใช้จ่ายต่างๆ รวมถึงค่าใช้จ่ายที่อาจเกิดจากการที่จะต้องดําเนิน  
  คดีหรือถูกดําเนินคดีทางศาลและการเรียกร้องค่าสินไหมทดแทนเกี่ยวกับการตาย การบาดเจ็บ การสูญหาย และความเสียหายต่างๆ ที่เกิดขึ้นกับตัวบุคคล  
  หรือทรัพย์สินของ นักแข่ง ไม่ว่าการดังกล่าวจะเกิดขึ้นเนื่องจาก หรือเกี่ยวกับ หรือสืบเนื่องมาจากการอนุมัติใบสมัคร หรือการร่วมการแข่งขันครั้งนี้และไม่ว่า  
  ความเสียหายดังกล่าวได้เกิดขึ้นเพราะนิติบุคคลดังกล่าว พนักงานของนิติบุคคล บริวารผู้แทน หรือตัวแทน ได้มีส่วนร่วมในการกระทําหรือกระทําโดย  
  ประมาทก็ตาม ข้าพเจ้าจึงลงลายมือชื่อไว้เป็นสําคัญต่อหน้าคณะกรรมการและพยาน  
  ข้าพเจ้ายินยอมให้บริษัทฯ เก็บรวบรวม ใช้ และ/หรือเปิดเผยข้อมูลส่วนบุคคล รวมทั้งยินยอมให้เก็บรวบรวมข้อมูลส่วนบุคคลในเอกสารข้างต้น  
  สําหรับวัตถุประสงค์ในการสมัครแข่งขันรถยนต์ทางเรียบ รายการ PT MAXNITRON RACING SERIES ของนักแข่งและทีมงาน ทั้งนี้เป็นไปตามพระราชบัญญัติ  
  คุ้มครองข้อมูลส่วนบุคคล พ.ศ.2562 หรือกฎหมาย/ระเบียบข้อบังคับอื่นๆ ที่เกี่ยวข้อง รวมถึงยินยอมให้ตรวจสอบความถูกต้องในรายละเอียดใบสมัครแข่งขัน  
  ข้าพเจ้าจึงลงลายมือชื่อเพื่อรับทราบและยินยอมตามข้อความดังกล่าวข้างต้น  
    
  I hereby agree not to claim any damages resulting from accidents during the competition and agree to be fully responsible for any  
  damages, on behalf of the organizer of the competition and all parties involved in organizing the event, including the venue owner,  
  sponsors, donors of the event, and all officials, representatives, and agents of the aforementioned, in the event of legal proceedings, claims for  
  compensation, expenses, or costs that may arise from the litigation or legal actions, as well as claims for damages related to death, injury,  
  loss, or other damages to the person or property of the competitor. This applies regardless of whether the damages result from or are connected  
  with the approval of the application or participation in this competition, and regardless of whether such damages occurred due to the actions  
  or negligence of the aforementioned legal entities, employees, agents, representatives, or other parties.  
  I consent to the company collecting, using, and/or disclosing my personal data, and I also consent to the collection of my personal data  
  in the above-mentioned documents for the purpose of registering for the PT MAXNITRON RACING SERIES road racing competition, both for  
  myself as a competitor and for the team. This consent is in accordance with the Personal Data Protection Act B.E. 2562 (2019) or other applicable  
  laws and regulations. I also agree to allow the verification of the accuracy of the competition registration details.  
    
  I hereby sign to acknowledge and consent to the above-mentioned terms.  
    
* **Digital Signature:** ด้านล่างสุดจะมีช่องสำหรับลงลายเซ็นสดผ่านหน้าจอ (Sign Canvas) พร้อมลงวันที่อัตโนมัติ  
* **Final Warning:** ระบบ Pop-up ยืนยัน: *"หาก Submit Form แล้ว คุณจะไม่สามารถแก้ไขข้อมูลได้ด้วยตนเอง ยืนยันการส่งใบสมัครไหม"*  
  ---

  ### 

  #### 

  #### 

  #### **4.3.3. Behind-the-Scenes Workflow (การทำงานหลังบ้าน)**

  #### **1\. การสร้างเอกสารแบบทวีคูณ (Multi-Event Spawn)**

เมื่อผู้ใช้กด Submit Form ในขั้นตอนสุดท้าย (หากเลือกไว้ 3 Event):

1. Backend จะรับก้อนข้อมูล (Payload) มา 1 ชุด  
2. Backend ทำการสร้าง Records ใน List `Entry Form` แยกเป็นตามจำนวน Event ใน Season นั้นๆเช่น 1 Season มี 3 Events ก็จะกลายเป็น 3 IDs (E1, E2, E3)   
3. แต่ละ Entry Form ที่สร้างขึ้นมาจะผูกกับ Event Rule ของ Event นั้นๆตามที่ Admin Setting ไว้

   #### **2\. กระบวนการอนุมัติ (Secretary Approval)**

1. Secretary เห็นรายการในสถานะ **Pending** ใน Dashboard  
2. Secretary ตรวจสอบความถูกต้องของข้อมูลทั้งหมด รวมถึงรูปถ่ายและเลขใบอนุญาต  
3. หากผ่าน: กด **Approve** \-\> สถานะเปลี่ยนเป็น **Active** \-\> ตั้งค่า `is_locked: true` ระบบส่ง Notification แจ้งนักแข่ง/Manager   
4. หากไม่ผ่าน: กด **Reject** \-\> ระบุเหตุผล \-\>สถานะเปลี่ยนเป็น **Rejected** \-\> ระบบส่ง Notification แจ้งนักแข่ง/Manager ให้แก้ไข

   #### **3\. ระบบซิงค์ข้อมูลข้ามสนาม (Automatic Data Propagation)**

นี่คือ Logic ที่ลดภาระให้นักแข่งเมื่อมีการเปลี่ยนข้อมูลระหว่างฤดูกาล:

* **Trigger:** เมื่อมีการส่งคำร้อง Competitor Request เพื่อแก้ไขข้อมูลสำคัญใน Entry ของ Event ปัจจุบัน และ Competitor Request นั้นได้รับการ **Approved** (เช่น แจ้งเปลี่ยนเครื่องยนต์กลางฤดูกาล)  
* **Process:** 1\. ระบบค้นหา Entry ใน "อนาคต" (Future Events) ของนักแข่งคนนี้ 2\. ตรวจสอบเงื่อนไข: `status` ต้องไม่ใช่ 'Active' และ `is_locked` ต้องเป็น `false` 3\. ระบบทำการ Copy ข้อมูลที่แก้ไข (Car/Team Info/etc.) ไปทับใบสมัครสนามถัดไปโดยอัตโนมัติ  
* **Result:** สมมุติในEvent ที่1 นักแข่งส่งคำร้องขอแก้ไขข้อมูล Entry Form และคำร้องนั้นได้รับการ Approved นักแข่งไม่ต้องเข้าไปไล่แก้ Entry Form ซึ่งยังเป็นสถานะ Draft อยู่ของ Event 2 และ 3 เอง ข้อมูลจะอัพเดตทันสมัยตามสนามที่ Active ล่าสุดเสมอ  
  ---

  #### **4.3.4. Audit & Integrity Rules (กฎการรักษาความถูกต้อง)**

* **Audit Logging:** ทุกการกดบันทึก (Save Draft) หรือการส่ง (Submit) จะต้องบันทึก `updated_by_id` เพื่อระบุว่านักแข่งหรือผู้จัดการทีมเป็นคนทำ  
* **Signature Reuse:** ลายเซ็นดิจิทัลจาก Step 5 จะถูกฝัง (Embedded) ลงในใบสมัครแต่ละ Event แยกจากกัน เพื่อป้องกันการนำลายเซ็นไปใช้ผิดวัตถุประสงค์  
* **Access Lock:** ตราบใดที่Accountนั้นๆไม่มี Entry Form ที่เป็นสถานะ **Active** (Approved) นักแข่งจะไม่สามารถเข้าถึงเมนู **Inspection Form** ,**Competitor Request** และ **Weight-in** ได้ (ระบบจะแสดงหน้าแจ้งเตือนให้รอการอนุมัติ)

### **4.4 Checklist Tab (ระบบตรวจสอบเอกสารและคุณสมบัติหน้างาน)**

**Checklist** **Tab**คือกระดานควบคุมทางธุรการ (Administrative Control Panel) ที่ใช้ติดตามความคืบหน้าของนักแข่งแต่ละคนว่าได้ทำตามข้อกำหนดของงานแข่งครบถ้วนหรือไม่ (เช่น จ่ายค่าสมัคร, ตรวจใบขับขี่ตัวจริง, เข้าร่วมประชุมนักแข่ง, เบิก Transponder) ระบบนี้ถูกสร้างมาเพื่อทดแทนการใช้กระดาษเช็คชื่อ (Paperless Registration) และลดการตอบคำถามหน้างาน

#### **4.4.1 Roles & Permissions (สิทธิ์การเข้าถึงและการแสดงผล)**

ระบบถูกออกแบบมาตรการป้องกันข้อมูลรั่วไหล (Data Privacy) อย่างเข้มงวด:

* **Admin (แอดมิน)/ Secretary (เลขาธิการสนาม):** **\[Full Access\]** มีสิทธิ์มองเห็นนักแข่งทุกคน จัดการหัวข้อ Checklist และติ๊กสถานะ (Check/Uncheck) ได้เต็มรูปแบบ  
* **Team Manager (ผู้จัดการทีม):** **\[Read-Only\]** มองเห็นสถานะ Checklist เฉพาะ "รถทุกคันในสังกัดทีมตัวเอง" เท่านั้น และไม่สามารถติ๊กแก้ไขข้อมูลได้  
* **Head of Scrutineer/ Scrutineer/ President/ Clerk of the course:** Read only มองเห็นสถานะ Checklist ของนักแข่งทุกคน  
* **Competitor (นักแข่ง):** **\[Read-Only\]** มองเห็นสถานะ Checklist เฉพาะ "รถของตัวเอง" เท่านั้น 

---

#### **4.4.2 Data Structure & Architecture (โครงสร้างข้อมูล)**

ระบบต้องรองรับกติกาการแข่งขันที่ปรับเปลี่ยนได้ทุกปี (Dynamic Rules) โดยไม่ต้องรื้อโค้ด:

* **Source of Truth (หัวข้อ):** โชว์ List ของ EntryForm ที่มีสถานะ Active พร้อมแสดงชื่อและเบอร์รถเป็น Column และถัดมาจะมี Column เป็นหัวข้อสำหรับ Checklist (Schema) และจะสามารถเพิ่มหรือลดหรือจัดเรียงลำดับColumn (Checklist Topic)ได้ภายใน Tab นั้นเลย โดยแต่ละแถวก็จะมีช่องให้ติ๊กถูก ถ้าCheck หรือ uncheck ที่ Checkbox ระบบจะบันทึก Log ว่าใครเป็นคนแก้ไขและวันเวลาเท่าไหร สามารถกดเพื่อดูย้อนหลังได้  
* **Dynamics:** แต่ละ Event หัวข้อสำหรับ Cheklist นั้นจะแตกต่างกันอาจมีเพิ่มหรือลด แต่เราต้องการที่จะดูบันทึกย้อนหลังได้ตลอดดังนั้นควรออกแบบระบบจัดเก็บข้อมูลให้ดี  
* **Dependency**: ข้อมูลใน Tab นี้ไม่ได้ส่งผลต่อข้อมูลอื่นๆเพียงแค่ใช้เป็น Checklist หน้างาน ที่ต้องสามารถบันทึกไว้ดูภายหลังได้ในแต่ละ Event ซึ่งชื่อหัวข้อและจำนวน Column Checklist จะไม่เหมือนกันในแต่ละ Event สามารถปรับเพิ่มลดได้

---

#### 

#### **4.4.3 The Workflows (กระบวนการทำงานทีละขั้นตอน)**

* มี Filter ตาม Year, Event, Series Race, Class  
* หน้า List นี้สามารถ Export PDF เพื่อปริ้นเป็นขนาด A4 ได้โดยต้องใช้พื้นหลังการปริ้นตามที่ Admin Setting ไว้

### **Workflow 1: Configuration (การตั้งค่าก่อนเริ่มงาน \- โดย Admin)**

1. **Column Setting:** Admin เข้าไปที่ Checklist Tab ซึ่งจะแสดงเป็น List นักแข่งที่มีสถานะของ EntryForm ของ Event นั้นเป็น Active และกดปุ่ม Settings บริเวณมุมบนขวาของ List-\> เพื่อกำหนดหัวข้อ Checklist ประจำ Event   
2. **Dynamic Rendering:** ระบบจะนำหัวข้อเหล่านี้ไปสร้างเป็น "คอลัมน์ (Columns) สำหรับ Checklist" ในหน้าList Checklist อัตโนมัติ

### **Workflow 2: On-site Registration (การตรวจรับหน้างาน \- โดย Secretary หรือ Admin)**

ในหน้า Checklist Tab UI จะถูกออกแบบเป็น **Data Grid / Spreadsheet View** เพื่อการทำงานที่รวดเร็ว:

1. **Candidate Listing:** ระบบดึงรายชื่อรถทุกคันที่มี Entry Form สถานะ **Active** มาแสดง  
2. **Smart Filtering:** Secretary/Admin สามารถค้นหาจากเบอร์รถ, ชื่อนักแข่ง,และ Filter by Series Race ได้  
3. **Fast-Toggle Verification (ติ๊กแบบรวดเร็ว):** \* เมื่อนักแข่งเดินมาที่โต๊ะ Secretary ตรวจสอบเอกสารตัวจริง (เช่น บัตรประชาชน, ใบรับรองแพทย์)  
   * Secretary กดติ๊ก Checkbox บนหน้าจอ  
   * **Real-time Save:** ระบบจะยิง Server Action ไปบันทึกข้อมูล (Auto-save) ทันทีโดยไม่ต้องกดปุ่ม Submit เพื่อความรวดเร็ว  
4. **Bulk Action (เช็คชื่อประชุมนักแข่ง):** ในช่วง Driver Briefing Secretary สามารถใช้ปุ่ม "Select All" เลือกนักแข่งที่อยู่ในห้อง และกดทำเครื่องหมาย "Briefing Attended" ให้ทุกคนพร้อมกันในคลิกเดียว  
5. **Print:** Admin หรือ Secretary สามารถกด print PDF ขนาด A4 ที่มีพื้นหลังเป็นรูปที่ Admin Set ไว้

### **Workflow 3: Self-Service Tracking (การตรวจสอบตัวเอง \- โดย Competitor/Manager)**

1. **Status View:** เมื่อนักแข่ง หรือ Team Manager ล็อกอินและเข้ามาที่ Checklist Tab จะเห็นแถบ Checklist ทุกcolumn แต่จะเห็นเฉพาะ Row ของตัวเอง หรือนักแข่งในสังกัดตัวเองหากเป็น Team Manager

---

#### **4.4.4 Automated Notifications & Reminders (ระบบแจ้งเตือนอัตโนมัติ)**

* **Trigger-Based (แจ้งเตือนตามเหตุการณ์):** Secretary หรือ Admin สามารถสั่งให้ระบบยิงแจ้งเตือนทั้ง In-app และ Email หา Competitor และ Manager ของรถคันที่ตัวเองเลือกได้ทันทีและสามารถระบุได้ว่าขาดอะไรอีกบ้างที่ยังไม่ได้ Check ในรายการ Checklist 

---

#### **4.4.5. Enforcement & Audit Trail (ข้อบังคับและความโปร่งใส)**

* **warning:** หากรายการใน Checklist ยังไม่ครบ 100% ระบบจะแสดงสัญลักษณ์เตือน   
* **Strict Auditing:** ทุกๆ การกด Check/Uncheck จะถูกบันทึกและ ระบุ `updated_by_id` และ `timestamp` อย่างชัดเจน) เพื่อใช้เป็นหลักฐานยืนยันหากเกิดข้อพิพาท

### **4.5 Inspection Form Tab (ระบบตรวจสภาพรถยนต์แบบไดนามิก)**

**Inspection Form** คือระบบที่เปลี่ยนกระดาษใบตรวจสภาพ (Scrutineering Sheet) ให้เป็นระบบ Digital 100% จุดเด่นของระบบนี้คือ **Dynamic Rule Engine** ที่จะสร้างฟอร์มการตรวจแตกต่างกันไปตาม "รุ่นการแข่งขัน (Series/Class)" ของรถคันนั้นๆ โดยอัตโนมัติโดยดึงข้อมูลForm จากที่ Admin ได้ตั้งค่าไว้ เพื่อให้กรรมการหน้างานเช็ครายการทางเทคนิคและความปลอดภัยได้อย่างรวดเร็วและแม่นยำที่สุด

#### **4.5.1. Roles & Permissions (สิทธิ์การเข้าถึงแบบละเอียด)**

* **Head Scrutineer:** **\[Full Access\]** ค้นหารถ, กรอกฟอร์มตรวจ, ใส่หมายเหตุ (แต่ไม่สามารถติ๊กช่องกติกาพิเศษเช่น *Off-site Inspected* ได้)  
* **Scrutineer Staff:** **\[Execute\]** ค้นหารถ, กรอกฟอร์มตรวจ, ใส่หมายเหตุ (แต่ไม่สามารถติ๊กช่องกติกาพิเศษเช่น *Off-site Inspected* ได้)  
* **Off-Site Scrutineer Staff:** **\[Specialized\]** สามารถติ๊กช่อง *Off-site Inspected* ได้ (สำหรับรถที่ขอตรวจสภาพล่วงหน้านอกสนาม)  
* **Admin / Secretary:** **\[Read & Edit\]** เข้าถึงและแก้ไขข้อมูลได้ทั้งหมดในกรณีฉุกเฉิน  
* **Competitor / Team Manager:** **\[Read-Only\]** ดูผลการตรวจสภาพของ "รถตัวเอง/รถในสังกัด" ได้เท่านั้น เพื่อตรวจสอบว่าผ่านหรือไม่ หรือต้องแก้ไขจุดไหน

---

#### **4.5.2 Data Architecture (โครงสร้างข้อมูลเบื้องหลัง) เพื่อให้ระบบยืดหยุ่นและรองรับการคำนวณ BOP ที่ซับซ้อน:**

* **`The Schema Source:`** `รายการที่ต้องตรวจจะถูกดึงมาจาก Inspection Form Builder ที่ Admin Configure ของ Event นั้นๆไว้`  
* `1 Inspection Form/1 active Entry Form/1 active Event`  
* `1 Inspection Form จะมีการแก้ไขตรวจแล้วต้องแก้ไขและกลับมาตรวจใหม่จนกว่าจะผ่าน ดังนั้นอยากให้ 1 Inspection Form มีหลาย Version เมื่อ Scrutineer Submit ผลของ Form แล้วจะบันทึกเป็น 1 version ของ Inspection Form นั้นๆ`  
* `สามารถ Visually เปรียบเทียบ 2 version ได้ว่ามีการเปลี่ยนแปลงอะไรไปบ้าง`  
* **`The Data Storage:`** `คำตอบการตรวจสภาพทั้งหมดจะถูกบันทึกพร้อมเช็ค Validate โครงสร้างแบบไดนามิกด้วย และ Inspection Form สามารถบันทึกและดูย้อนหลังของ Event ก่อนๆได้ถึงแม้แต่ละ Event นั้น Inspection Form จะมี Schema ที่ต่างกัน`  
* **`The Calculated Weight Column [สำคัญ]:`** `ใน Create Inspection Form จะเป็น Progressive Form ซึ่งจะมี 1` Section `ที่เกี่ยวข้องกับ BOP Weight (Base weight+Option weight) สำหรับEventนั้น ซึ่งFormนี้ทั้งนักแข่งและ Scrutineer ต้องกรอกเพื่อมีข้อมูลให้ระบบคำนวณ BOP อัตโนมัติเมื่อเสร็จแล้วจะสร้างเป็นตัวแปรเก็บค่า BOP แยกไว้ต่างหาก เพื่อให้ระบบ Weight-In สามารถดึงค่าไปใช้ต่อได้อย่างรวดเร็วโดยไม่ต้อง Parse JSON ใหม่`  
* **`Seal Management:`** `ใน progressive Form จะมี 1` Section `ที่จัดการเรื่อง Engine and Gear seal number ซึ่ง Scrutineer จะเป็นคนดูเลข Seal และกรอก โดย 1 Engine/Gear อาจมีได้มากกว่า 1 Seal และจะมีช่องให้ติ๊กสำหรับ Off-Site Scrutineer ว่า Engine และ Gear ได้ถูกตรวจสภาพนอกสถานที่แล้วหากรถคันนี้แข่งได้อันดับดีมากๆก็ไม่จำเป็นต้องรื้อเครื่องและเกียร์เพื่อตรวจสอบซึ่งจะลดเวลาไปได้เยอะ`  
* **`Audit & Relation:`** `ตารางนี้ต้องผูกความสัมพันธ์กับ Entry Form ของนักแข่งรายคนในแต่ละ Event เพราะทุก Event จะมีการตรวจสภาพก่อนเสมอและเมื่อ Scrutineer ตรวจสอบเสร็จสิ้นและกด Submit Form แล้วระบบต้องบันทึกด้วยว่า Scrutineer คนไหนเป็นคนตรวจ ตรวจตอนกี่โมง`  
* **`History Log`**`: สามารถกดดู Log การเปลี่ยนแปลงทุกข้อมูลที่เกี่ยวข้องและเลือกมาเปรียบเทียบการเปลี่ยนแปลงของแต่ละ Version ได้ถึงแม้ Schemaจะไม่เหมือนกัน`

---

#### **4.5.3 UI/UX Requirements (ข้อกำหนดหน้าจอ)**

* เมื่อกดเข้ามาใน Inspection Form Tab: จะเป็นรูปแบบตาราง และมี List ของ Inspection Form ที่ Competitor หรือ Team Manager เป็นคน Submit มา โดยในแต่ละ Row จะมีปุ่ม Action สามารถกด Inspectและดูประวัติการตรวจได้ ได้ ใน Tab นี้จะมีปุ่มกด Create Inspection Form สำหรับสร้าง Inspection Form ใหม่  
* **Color Coding ชัดเจน:**   
  * 🟢 List Row มีพื้นหลังสีเขียว \= Pass (ผ่าน)   
  * 🔴 List Row มีพื้นหลังสีแดง \= Fail (ไม่ผ่านต้องกลับไปแก้ไข)  
  * ⚪ List Row มีพื้นหลังสีเทา \= Pending (ยังไม่ได้ตรวจ)  
* **เมื่อกดปุ่ม Create Inspection Form:** จะเด้งเป็น popup window ซึ่งเป็น Progressive Form และจะออกแบบให้ **iPad / Mobile First**   
* **Progress Indicator:** แสดงจำนวนข้อที่ตรวจไปแล้วในแต่ละ Section (เช่น Safety 4/6)  
* **Sticky Info:** ข้อมูลเบอร์รถและนักแข่งต้องลอยอยู่ด้านบนของPopup Windowเสมอ (Sticky Header)  
* ถ้าเป็น Competitor/Team manager จะมองเห็นแค่ List Inspection Form ของตัวเองหรือนักแข่งในสังกัดตัวเอง  
* ถ้าเป็น Role อื่นๆนอกจาก Competitor หรือ Team manager จะสามารถเห็น List Inspection Form ของนักแข่งทุกคนได้  
* มี Filter ตาม Year, Event, Series Race, Class  
* หน้า List นี้สามารถ Export PDF เพื่อปริ้นเป็นขนาด A4 ได้ และใช้พื้นหลังPDFตามที่ Admin Setting ไว้

---

#### **4.5.4. The Trackside Workflow (กระบวนการทำงานหน้างานทีละขั้นตอน)**

### **ใน Progressive Form แบ่งเป็น Section**

- Section1: Driver  
- Section2: Car  
- Section3: Weight  
- Section4: Safety  
- Section5: Seal  
- Section6: Review

  ### **Step 0: Competitor / Team manager fill the form**

1. Competitor หรือ Team Manager กดปุ่ม Create Inspection Form  
2. ระบบจะดึงข้อมูลคำถามมาจากที่ Admin Setting ใน Inspection Form Builder ของ Event นั้นๆ มาทำเป็น Form  
3. Progressive Form popup ขั้นมาให้กรอก โดย Competitor หรือTeam manager จะสามารถกรอกได้ทั้ง 5 Sections เลยซึ่งใน Section 1-3 ข้อมูลที่สามารถ Auto-filled ได้โดยดึงจาก Active Entry Form ก็ให้ Auto-filled เลย หากข้อไหนไม่รู้ก็สามารถข้ามไปก่อนได้  
4. เมื่อถึง Section 6 และรีวิวเสร็จแล้วกด Submit For Inspection จะขึ้นให้ยืนยันและแจ้งว่าหลังจากกดยืนยันจะไม่สามารถแก้ไขFormได้ยกเว้นทีมงานจะแก้ไขให้  
5. เมื่อกดยืนยัน Inspection Form นั้นจะเปลี่ยนสถานะเป็น “Pending” และ Competitor หรือ Team manager จะไม่สามารถแก้ไข Inspection Form ได้แล้ว  
6. 1 Active Entry Form จะมีได้แค่ 1 Inspection Form/ Active Event ไม่สามารถสร้างได้มากกว่า 1

   ### **Step 1: การเลือกรถ (Vehicle Selection)**

1. มีคนนำรถเข้า Station เพื่อ Inspection รถ Scrutineer staff ที่หน้างานเปิด Web-App นี้  
2. Scrutineer เข้ามาที่ Inspection Form Tab  
3. **Fetch:** ระบบจะแสดง List Inspection Form ที่มีสถานะเป็น **'Pending'**   
4. **Search:** Filter ค้นหาด้วยเบอร์รถ (Car Number) และ Series Race  
5. กด Action button ที่ Row ของ List Inspection Form ที่ต้องการตรวจ  
6. ระบบจะ แสดง Inspection Form นั้นในรูปแบบ  popup window Progressive Form  
7. **Verification Header:** แสดงข้อมูลสำคัญค้างไว้บนหัว Progressive Form ตลอด (Sticky Header):  
   * เบอร์รถ, รุ่น (Series Race), ยี่ห้อ/รุ่นรถ, ชื่อนักแข่ง, ทีม

   ### 

   ### **Step 2: การแก้ไขข้อมูลเทคนิคหน้างาน (Scrutineer Override)**

หากข้อมูลใน Inspection Form ไม่ตรงกับรถจริงที่อยู่ตรงหน้าเนื่องจากบางข้อมูลดึงมาจาก Entry Form บ้าง นักแข่งหรือผู้จัดการทีมกรอกเองบ้างซึ่งอาจจะกรอกผิด:

1. Scrutineer สามารถแก้ไขข้อมูลใน Inspection Form ได้ทุก Section ตั้งแต่ Section1-5  
2. **Audit Trail:** ระบบบันทึกประวัติการแก้ไขเป็นทีละ Version  (Old Value \-\> New Value) พร้อมชื่อกรรมการ และแจ้งเตือนนักแข่งโดยอัตโนมัติ

   ### **Step 3: การตรวจสภาพ(Accordion Inspection)**

- กรรมการเดินตรวจรอบรถและไล่กรอกข้อมูลหรือแก้ไขข้อมูลที่ถูกกรอกมาหรือแก้ไขการติ๊ก Checkbox ต่างๆทุกข้อและต้องทำการระบุสถานะแต่ละข้อว่าPass/Fail พร้อม Comment  ในแต่ละข้อ ( Item)  ในแต่ละ Section ตาม Inspection Form Builder ที่ Admin เป็นคนตั้งค่าไว้ หากเว้นว่างไว้จะมีกรอบสีเหลืองเพื่อเตือน Scrutineer   
- มี Progress Count ในแต่ละ Section ด้วยเพื่อให้ผู้ตรวจรู้ว่าตรวจครบไหม  
  ---

  ### **Step 4: หมวดน้ำหนักและการคำนวณ BOP (Weight & BOP Assessment)**

**นี่คือส่วนพิเศษที่มีการคำนวณ (Calculation Logic):**

1. ใน Section ที่ 3 (Weight) ของ Inspection Form ระบบจะดึงข้อมูลFormมาจาก ที่Admin ตั้งค่าไว้  
2. **Base Weight:** จะมีเป็น Options ให้ Scrutineer เลือกว่ารถคันนี้ความจุเครื่องเท่าไหรและจะบวกน้ำหนัก Base weight ตามที่ Admin ได้ตั้งค่าไว้ใน Inspection Form Builder ซึ่งระบบมันจะ Auto-Select ตัวเลือกความจุเครื่องตามข้อมูลใน Active Entry Form และจะบวกน้ำหนักอัตโนมัติ แต่ Scrutineer สามารถแก้ไขไปเลือกตัวเลือกอื่นได้ หรือหาก Admin ตั้งค่าItem ว่าเป็น Vary Weight ก็จะมีช่องให้ Scrutineer กรอกน้ำหนักที่จะบวกไปได้เลย  
3. **Option Weight:** กรรมการติ๊กออปชันเสริมของรถคันนั้น (เช่น Sequential Gear \+30kg, 4WD \+50kg)  
4. **Official BOP Weight:** ระบบรวมผลลัพธ์ `(Base + Option)` เพื่อใช้เป็นค่าน้ำหนักอ้างอิงของรถคันนั้นประจำ Eventนั้นๆ  
5. **Result:** ตัวเลข BOP นี้จะถูกส่งต่อไปยัง Tab **Weight-In** เพื่อบวกกับ Success Ballast ในแต่ละเรซต่อไป  
   ---

   ### 

   ### **Step 5: การตัดสินผลและการแจ้งเตือน (Status & Notification)**

1. **Failed Case:** หากตอนไล่ตรวจและมีข้อใดข้อหนึ่ง (Item) เป็น `Fail` สถานะ Inspection Form จะเป็น **"Failed"** ทันที และระบบจะบังคับให้ใส่หมายเหตุ (Issue Note)  
2. **Real-time Alert:** ระบบส่งแจ้งเตือน (In-app/Email) ให้นักแข่งทราบจุดที่ต้องแก้ไข  
3. **Re-inspection:** เมื่อแก้ไขเสร็จ กรรมการเปลี่ยนสถานะเป็น `Pass` ระบบจะคำนวณผลใหม่เป็น **"Passed"**
4. **Database Eligibility Trigger:** ทุกครั้งที่ `inspection_forms.status` เปลี่ยน Database ต้องอัปเดต `entry_forms.is_eligible_to_race` เองอัตโนมัติ ถ้า status = `Passed` เท่านั้นจึงให้ลงสนามได้ (`true`) หากเป็น `Hold`, `Failed`, `Pending`, หรือ `Draft` ต้องบังคับเป็น `false` ห้าม React/Frontend ส่งค่า eligibility ไปบันทึกเองเด็ดขาด

---

#### **4.5.5. Security & Integrity Constraints (กฎระเบียบทางเทคนิค)**

* **Role Constraint:** ปุ่ม *Off-site Inspected* (ตรวจสอบนอกสถานที่) ต้องถูก `disabled` หากผู้ใช้ไม่ได้ล็อกอินด้วย Role: Off-Site Scrutineer Staff  
* **Audit Trail:** ทุกการเปลี่ยนแปลงสถานะ (Pass \-\> Fail หรือ Fail \-\> Pass) ต้องมีการบันทึกลงตาราง `audit_logs` ว่าใคร (`updated_by_id`) เป็นคนแก้ไข เมื่อเวลาใด

### 

### 

### 

### 

### 

### 

### **4.6 Weigh-in Tab (ระบบชั่งน้ำหนักและพิกัดถ่วง)**

เพื่อบริหารจัดการการชั่งน้ำหนักรถแข่งหน้างานตาชั่ง ให้มีความแม่นยำ โปร่งใส และรวดเร็ว โดยระบบต้องคำนวณน้ำหนักเป้าหมาย (Target Weight) ให้โดยอัตโนมัติจากหลายปัจจัย (BOP, Success Ballast, Penalty, Join Weight) เพื่อลดภาระการคำนวณด้วยมือของกรรมการ

#### **4.6.1 ข้อมูลขาเข้าสำหรับการคำนวณ (Data Components)**

ระบบจะดึงข้อมูลจากหลายแหล่งมาประมวลผลเป็น **"Final Target Weight"** ดังนี้:

1. **Official BOP Weight (น้ำหนักฐาน):** ดึงค่ามาจากข้อมูลใน Inspection Form ของรถคันนั้นๆที่สรุปไว้ตอนตรวจสภาพก่อนเริ่ม Event  
2. **Success Ballast (พิกัดถ่วงความสำเร็จ):** ดึงค่ามาจากการตั้งค่าของ Admin และผลการแข่งขันของเรซก่อนหน้า (เช่น อันดับ 1-3 สนามที่แล้ว)  
3. **Penalty Weight (น้ำหนักทำโทษ):** ดึงข้อมูลมาจาก Competitor Request ที่มีการอนุมัติแล้วและมีบทลงโทษเป็นตัวเลขน้ำหนักให้ถ่วงเพิ่ม  
4. **Join Weight (น้ำหนักสำหรับนักแข่งใหม่):** ระบบคิดให้อัตโนมัติ หากเป็นรถที่เพิ่งมาเข้าร่วมแข่งครั้งแรกของฤดูกาลใน Event ที่2เป็นต้นไป  โดยจะบวกน้ำหนักเท่ากับค่า Max Success Ballast (น้ำหนักถ่วงที่หนักที่สุดที่นักแข่งคนอื่นใช้)  ของรุ่นนั้นๆ **เพียง 1 Race เท่านั้น** 

#### **4.6.2. กระบวนการทำงาน (Step-by-Step Workflow)**

#### **Step 1: Session Context Selection (การเลือกช่วงเวลา)**

เนื่องจาก 1 Event มีหลาย Race กรรมการต้องเลือกบริบทก่อนเสมอ:

1. **Select Race/Session:** เลือกผ่าน Dropdown (เช่น Qualifying, Race 1, Race 2, หรือ Race 3\)  
2. **Context Loading:** ระบบจะเตรียม Logic การดึง Success Ballast ให้สอดคล้องกับช่วงเวลาที่เลือก (เช่น Race 2 ต้องใช้ผลจาก Race 1\)

#### **Step 2: Car Selection (การเลือกรถแข่ง)**

1. **Entry Search:** กรรมการพิมพ์เบอร์รถ (Car Number) ที่กำลังขึ้นตาชั่ง  
2. Filter: กรรมการสามารถ Filter by Series Race  
3. **Data Fetching:** ระบบดึงข้อมูลรถและประวัติน้ำหนักที่ต้องถ่วงทั้งหมดมาเตรียมคำนวณ

#### **Step 3: Automated Weight Breakdown (การคำนวณและแจกแจง)**

ระบบจะแสดง **"สูตรน้ำหนัก"** บนหน้าจอ iPad ให้กรรมการเห็นที่มาที่ไปอย่างโปร่งใส:

* `Base BOP Weight` (e.g., 900 kg)  
* `Option Weight` (e.g., \+30 kg)  
* `Success Ballast` (e.g., \+15 kg)  
* `Penalty/Join Weight` (e.g., \+50 kg)  
* 🏁 **Final Target Weight:** **1,000 kg** (ตัวเลขขนาดใหญ่ สีเด่นชัด)

#### **Step 4: Actual Weight Input (การบันทึกน้ำหนักจริง)**

1. **Input:** กรรมการกรอกตัวเลข **"Actual Weight"** ที่อ่านได้จากตาชั่งลงในช่อง Input ขนาดใหญ่  
2. **Instant Validation:** ระบบเปรียบเทียบทันที:  
   * หากน้ำหนักจริง **\>=** Target ➡️ แสดงสถานะ 🟢 **PASS** (สีเขียว)  
   * หากน้ำหนักจริง **\<** Target ➡️ แสดงสถานะ 🔴 **FAILED** (สีแดง) พร้อมบอกจำนวนที่ขาด (เช่น "ขาดไป 2 kg")

#### **Step 5: Auto-save & Logging (การบันทึกและตรวจสอบ)**

1. **Real-time Save:** เมื่อกรอกตัวเลขเสร็จ ระบบจะบันทึกข้อมูลลงตาราง `weigh_in_logs` ทันทีผ่าน Server Action  
2. Scrutineer สามารถแก้ไขน้ำหนัก Actual Weight ได้  
3. **Data Recorded:** ข้อมูลที่บันทึกประกอบด้วย: `entry_id`, `race_id`, `session_type`, `actual_weight`, `target_weight`, `status`, และ `timestamp`  
4. **Audit Trail:** บันทึกชื่อกรรมการผู้ที่ทำการชั่งน้ำหนัก (`scrutineer_id`)

---

#### **4.6.3 กฎพิเศษและข้อยกเว้น (Special Logic Rules)**

* **Join Weight Logic:** ระบบต้องตรวจสอบว่ารถคันนี้มีการลงแข่งใน Event ก่อนหน้าหรือไม่? หากไม่มี และนี่คือการลงแข่งครั้งแรกในเรซที่จัดขึ้นหลัง Event 1 ระบบต้องไป Query หาค่า Success Ballast ที่สูงที่สุดในรุ่นนั้นมาบวกเป็น Join Weight เฉพาะเรซแรกให้โดยอัตโนมัติ  
* **Penalty Weight Overwrite:** หากมี Penalty จากใบคำร้อง (Request) ที่ระบุว่าให้มีผลเฉพาะ Race ใด Race หนึ่ง ระบบต้องดึงมาคำนวณให้ถูกต้องตาม ID ของเรซนั้นๆ  
* **Re-weighing:** รถสามารถขึ้นชั่งซ้ำได้หากไม่ผ่าน ระบบจะบันทึก Log การชั่งทุกครั้ง แต่จะยึดค่าล่าสุด (Latest Record) เป็นสถานะทางการ

---

#### **4.6.4. UI/UX Requirements (สำหรับ iPad หน้าตาชั่ง แต่ก็ยังสามารถดูผ่านโทรศัพท์หรือ computer)**

* เมื่อเข้ามาที่ Weight-In Tab จะโชวในรูปแบบ List ที่ระบุ เบอร์รถ, Target Weight พร้อมแจกแจงสูตรน้ำหนัก, ช่องใส่ Actual weight, ปุ่มกดดู Log ของ Row นั้นๆ  
* **Numeric Keypad Only:** เมื่อกดช่องกรอกน้ำหนัก ให้ระบบโชว์แป้นตัวเลขขนาดใหญ่ (Numeric Keypad) เท่านั้น  
* **High Contrast Status:** สีแดงและสีเขียวต้องชัดเจนมาก (High Contrast) เพื่อให้มองเห็นได้ง่ายในสภาพแสงจ้ากลางแจ้ง  
* **Breakdown Card:** ใช้ `shadcn/ui` แบ่งสัดส่วนของสูตรคำนวณให้ดูง่าย ไม่ซ้อนทับกัน  
* **Race Info Header:** แสดงชื่อ Race และ Session ที่เลือกไว้บนหัวมุมจอตลอดเวลาเพื่อป้องกันการกรอกผิด Session  
* ถ้าเป็น Competitor/Team manager เข้ามาที่ Weight-In tab จะมองเห็นแค่ List Weight-in ของตัวเองหรือนักแข่งในสังกัดตัวเอง

แต่ถ้าเป็น Role อื่นๆจะสามารถเห็น List Weight-in ของนักแข่งทุกคนได้

* มี Filter ตาม Year, Event, Series Race, Class  
* หน้า List นี้สามารถ Export PDF เพื่อปริ้นเป็นขนาด A4 ได้และขะมีพื้นหลังของ PDF เป็นรูป background ที่ Admin ตั่งค่าไว้

#### **4.6.5. การคิด Success Ballast ทั้ง 2 ระบบ**

**1\. ระบบ Success Ballast (ยิ่งชนะ ยิ่งโดนแบกสะสม)**

**ใช้สำหรับรุ่น:** SIAM TRUCK, SIAM GROUP A, SIAM GROUP N และ SIAM ECO

ระบบนี้คือ **"การสะสมน้ำหนัก"** แข่งชนะโดนบวกเพิ่ม แต่ถ้าแข่งแพ้จะได้ปลดน้ำหนักออก โดยมีหลักการคิดดังนี้ครับ:

* **ตอนได้บวกน้ำหนัก:** ดูจากอันดับในเรซที่เพิ่งแข่งจบ ถ้าเข้าเส้นชัยอันดับ 1 โดนถ่วง 30 กก., อันดับ 2 โดน 20 กก. และอันดับ 3 โดน 10 กก. หรือตามที่ Admin ตั้งค่าไว้  
* **เพดานน้ำหนัก (Max Cap):** น้ำหนักก้อนนี้มีลิมิตสะสมสูงสุด รุ่นกระบะ (TRUCK) สะสมได้สูงสุด 90 กก. ส่วนรุ่นเก๋ง (A, N, ECO) สะสมได้สูงสุด 60 กก.หรือตามที่ Admin ตั้งค่าไว้  
  * *ตัวอย่าง:* สมมติรถคุณแบกอยู่แล้ว 50 กก. เรซล่าสุดได้ที่ 2 (ต้องโดนบวก 30 กก.) แต่น้ำหนักเพดานรุ่นคุณคือ 60 กก. คุณจะโดนบวกเพิ่มแค่ 10 กก. (ให้ชนเพดานพอดี)   
* **ตอนได้ปลดน้ำหนัก:** ถ้านักแข่งทำผลงานหลุด Top 3 (คือได้อันดับ 4 ลงไป), รถพังแข่งไม่จบ (DNF), ไม่ได้แข่ง (DNS) หรือถูกปรับแพ้ (DQ) **ระบบจะถอดก้อนน้ำหนัก "ที่หนักที่สุด" ที่รถคันนั้นกำลังแบกอยู่ออก 1 ก้อน**  
  * *ตัวอย่างต่อเนื่อง:* จากข้อที่แล้ว คุณแบกก้อน 50 กก. กับก้อน 10 กก. อยู่ ถ้าเรซถัดมาคุณแข่งไม่จบ กรรมการจะหยิบก้อน 50 กก. ออกไปทิ้ง ทำให้คุณเหลือแบกแค่ 10 กก. ในเรซต่อไป

**2\. ระบบ Championship Weight (ถ่วงตามคะแนนแชมป์ \- ไม่สะสม)**

**ใช้สำหรับรุ่นใหญ่:** SIAM GTRC และ SIAM GTMC

ระบบนี้เข้าใจง่ายมากครับ เพราะ **"ไม่มีการสะสม"** จบเรซปุ๊บ ถอดทิ้งแล้วคิดใหม่เป็นรอบๆ ไป

* **ดูจากคะแนนสะสม:** ระบบจะดูตารางคะแนนสะสมชิงแชมป์ประจำปี (Overall) ใครมีคะแนนรวมเป็นอันดับ 1 จะโดนถ่วง 50 กก., อันดับ 2 โดน 30 กก., อันดับ 3 โดน 20 กก. (ถ้าคะแนนเท่ากัน ให้ดูอันดับในเรซล่าสุด)  
* **จบเรซคือจบกัน:** แข่งเรซนั้นเสร็จ เมื่อเริ่มเรซใหม่ ก้อนน้ำหนักของเรซที่แล้วจะถูกถอดออกทั้งหมด และจัดน้ำหนักถ่วงให้ใหม่ตามตารางคะแนนสะสมล่าสุด

**กรณียกเว้น: นักแข่งมาสมัครช้า (Late Entry / Join Rate)**

กฎนี้มีไว้กันคนมาทีหลังแล้วได้เปรียบรถคันอื่นที่แบกน้ำหนักสะสมมาจนหนักแล้ว โดยจะบังคับใช้กับนักแข่งที่โผล่มาแข่งหลังจากเรซที่ 2 ไปแล้ว

* **สำหรับรุ่นสะสมน้ำหนัก (Success Ballast):** ในเรซแรกที่ลงแข่ง จะถูกบังคับให้แบกน้ำหนักเท่ากับ **"รถคันที่หนักที่สุดในเรซนั้น"** พอแข่งจบเรซก็ให้ถอดออก แล้วเรซต่อไปค่อยเริ่มคิดบวก/ลบตามผลงานของตัวเอง  
* **สำหรับรุ่นไม่สะสมน้ำหนัก (Championship):** ในเรซแรกที่ลงแข่ง จะโดนบังคับถ่วงเท่ากับผู้นำแชมป์เปี้ยนชิพ และจะถูกถอดออกเมื่อจบการแข่งขันเรซนั้น

**สรุปสั้นๆ สำหรับคนหน้าตาชั่ง:** น้ำหนักที่ต้องเช็ค \= น้ำหนักสเปครถ (BOP) \+ น้ำหนัก Penalty \+ น้ำหนัก Join weight \+ ก้อนน้ำหนัก Success Ballast (ต้องเช็คก้อนน้ำหนักด้วยว่าถูกต้องไหม)

**เพิ่มเติม: การออกแบบระบบให้ Admin ตั้งค่าได้ (Dynamic Configuration)**

ในมุมมองของการพัฒนาระบบ เราจะต้องสร้างหน้า **"แผงควบคุมกฎกติกา (Rules & Weight Settings)"** ให้ Admin สามารถกรอกและปรับเปลี่ยนตัวเลขต่างๆ ได้เองเสมอ โดยมีรายละเอียดดังนี้ครับ:

**1\. ระบบ Success Ballast (สะสมน้ำหนัก)** Admin จะสามารถตั้งค่าตัวแปร (Variables) เหล่านี้แยกตาม "รุ่นการแข่งขัน" (Class) ได้ด้วยตัวเอง:

* **กำหนด Max Cap (เพดานสูงสุด):** Admin สามารถพิมพ์กำหนดได้เลยว่ารุ่น TRUCK ตันที่ 90 กก. หรือรุ่น ECO ตันที่ 60 กก. และถ้าปีหน้ากติกาเปลี่ยนเป็น 100 กก. Admin ก็แค่พิมพ์แก้ตัวเลขในระบบ  
* **กำหนดน้ำหนักที่ต้องบวกตามอันดับ:** Admin สามารถตั้งค่าได้ว่า อันดับ 1, 2, 3 จะโดนบวกก้อนละเท่าไหร่ (เช่น ปัจจุบันตั้งไว้ที่ \+30, \+20, \+10 กก.)  
* **กำหนดเงื่อนไขการถอดน้ำหนัก:** Admin สามารถเซ็ตค่าได้ว่า หากได้อันดับต่ำกว่าเท่าไหร่ (เช่น ต่ำกว่าอันดับ 3\) หรือแข่งไม่จบ ให้ระบบ "ถอดก้อนที่หนักที่สุดออก"

**2\. ระบบ Championship Weight (ถ่วงตามคะแนนแชมป์ \- ไม่สะสม)** Admin จะสามารถตั้งค่าตัวแปรสำหรับรุ่นใหญ่ (GTRC, GTMC) ได้อิสระ:

* **กำหนดก้อนน้ำหนักตามอันดับคะแนน:** Admin สามารถเข้าไปตั้งค่าน้ำหนักที่จะถ่วงผู้นำแชมป์เปี้ยนชิพได้เอง เช่น ตั้งค่าให้อันดับ 1 โดน 50 กก., อันดับ 2 โดน 30 กก., อันดับ 3 โดน 20 กก. และระบบจะนำก้อนนี้ไปคำนวณแบบ "รอบต่อรอบ" (ไม่สะสม) อัตโนมัติ

**3\. กรณียกเว้น: นักแข่งมาสมัครช้า (Late Entry)**

* Admin จะสามารถกดเปิด/ปิด กฎนี้ได้ และตั้งค่าได้ว่า "นักแข่งที่มาทีหลัง จะต้องโดนบังคับถ่วงน้ำหนักเท่ากับรถที่หนักที่สุดในเรซนั้น" หรือ "โดนบังคับถ่วงเท่ากับผู้นำคะแนนแชมป์" ตามกติกาของรุ่นนั้นๆ

#### **4.6.6 Roles & Permissions (สิทธิ์การเข้าถึงแบบละเอียด)**

* **Head Scrutineer / Scrutineer Staff / Off-Site Scrutineer Staff:** **\[Full Access\]** เห็น List Weight-in ของทุกคนและสามารถกรอก/แก้ไข Actual Weight ได้  
* President / Steward / Clerk of the course: เห็น List Weight-in ของทุกคน  
* **Admin / Secretary:** **\[Read & Edit\]** เข้าถึงและแก้ไขข้อมูลได้ทั้งหมดในกรณีฉุกเฉิน  
* **Competitor / Team Manager:** **\[Read-Only\]** ดู List Weight-in ของ "รถตัวเอง/รถในสังกัด" ได้เท่านั้น เพื่อตรวจสอบว่าผ่านหรือไม่ หรือต้องแก้ไขจุดไหน

### 

### **4.7. Competitor Request Tab (ใบคำร้อง/ประท้วง)**

เพื่อจัดการระบบใบคำร้องและข้อพิพาทหน้าสนาม โดยมีระบบ **Dynamic Routing** ที่ทำได้ภายใน Competitor Request แต่ละอันได้เลยโดยให้เลขาธิการสนาม (Secretary) สามารถดึงตัวกรรมการผู้เชี่ยวชาญเข้ามาร่วมพิจารณาเป็นรายเคสได้ พร้อมระบบบันทึก Audit Log ระดับวินาที และเชื่อมโยงบทลงโทษ (Penalty Weight) เข้าสู่ระบบWeight-inอัตโนมัติ หรือมีค่าปรับต่อนักแข่ง/Manager และในอนาคตอยากจะ Auto-overwrite ข้อมูลหากได้รับการ Approve ตามหัวข้อที่ Competitor/Team Manager เลือกโดยใช้ข้อมูลที่กรอกใหม่ใน Request นั้นไป Overwrite ข้อมูลเก่า 

#### **4.7.1 โครงสร้างสิทธิ์และการมีส่วนร่วม (The Approval Matrix)**

ระบบนี้มีผู้เล่น 3 กลุ่มหลักที่สถานะการอนุมัติจะส่งผลต่อ Flow ของเอกสาร:

* **กลุ่มที่ 1: ผู้ร้องขอ (The Requester)**  
  * **Competitor (นักแข่ง):** เป็นเจ้าของสิทธิ์ที่แท้จริง หากเป็นผู้ส่งคำร้องเอง ระบบจะถือว่า **"Auto-Approve ในส่วนของตัวเอง"** ทันที  
  * **Team Manager (ผู้จัดการทีม):** สามารถพิมพ์และส่งคำร้องแทนได้ แต่จำเป็นต้องมี Competitor เข้ามากด **Approve (ยินยอม)** พร้อมใส่คอมเมนต์  
* **กลุ่มที่ 2: คณะกรรมการพิจารณา (The Committee \- Optional)**  
  * ประกอบด้วย: `Clerk of the Course`, `President`, `Steward`, `Head of Scrutineer`  
  * **สิทธิ์:** จะเห็นและมีสิทธิ์กดพิจารณาก็ต่อเมื่อ **"Secretary เลือกส่งคำร้องนี้มาให้พิจารณา"** เท่านั้น โดยสามารถกด Approve / Reject พร้อมใส่ Comment  
* **กลุ่มที่ 3: ผู้ชี้ขาดและควบคุมระบบ (The Gatekeeper & Finalizer)**  
  * **Secretary:** เป็นผู้ดำเนินการหลัก กำหนดค่าปรับ (Fine) กำหนดน้ำหนักทำโทษ (Penalty Weight) เลือกเชิญคณะกรรมการมาร่วมตัดสิน และเป็น **"ผู้กด Approve / Reject พร้อม Comment เป็นคนสุดท้ายเพื่อจบกระบวนการ"**

* **Dropdown Enforcement (Security):** เมื่อสร้าง Competitor Request นักแข่ง หรือ Team Manager ต้อง "เลือกเบอร์รถ" จาก Dropdown ที่ดึงมาจาก Entry Form ของตัวเองที่ Active แล้วเท่านั้น (ป้องกันการกรอกชื่อและเบอร์รถคนอื่น)   
* **Penalty Action:** Secretary สามารถบันทึกค่าปรับเงิน (fineAmount) หรือปรับกริดสตาร์ท (gridPenalty) หรือเพิ่มน้ำหนักถ่วง (Penalty Weight) ลงในคำร้องนั้นๆได้ตามดุลยพินิจและ หากเป็นการเพิ่มน้ำหนักถ่วง (Penalty Weight)จะต้องนำมาคิดใน Tab Weight-in ด้วย ส่วนถ้าเป็นเงินค่าปรับหรือปรับกริดสตาร์ทก็ควรจะไปเด้งแจ้งเตื่อนในหน้า Dashboard ของ Competitor / Team Manager   
* Competitor Request จะผูกกับ Active Entry Form ของนักแข่งคนนั้นๆ คือ 1 Entry Form มีได้หลาย Competitor Request Form   
* หากกด Create Competitor Form จะเด้งเป็น Form ให้กรอก และจะAuto-Save และFormจะมีสถานะเป็น Draft เมื่อกรอกเสร็จและกด Submit Form จะมีการเด้งแจ้งเตือนให้ยืนยันก่อนว่าถ้ายืนยันแล้วจะไม่สามารถแก้ไขข้อมูลได้ เมื่อกดยืนยัน สถานะ Competitor Request Form จะกลายเป็น “Pending”  
* ถ้าเป็น Competitor/Team manager จะมองเห็นแค่ List Competitor Request ของตัวเองหรือนักแข่งในสังกัดตัวเอง

แต่ถ้าเป็น Role อื่นๆจะสามารถเห็น List Competitor Request ของนักแข่งทุกคนได้

* มี Filter ตาม Year, Event, Series Race, Class  
* หน้า List นี้สามารถ Export PDF เพื่อปริ้นเป็นขนาด A4 ได้

#### 

#### **4.7.2 กระบวนการทำงาน (Step-by-Step Workflow)**

#### **Step 1: Submission & Consent (การยื่นเรื่องและการยินยอม)**

1. **Creation:** ผู้ใช้เลือก Series Race , เบอร์รถที่ตนเองมีสิทธิ์ ,หัวข้อคำร้อง และมีช่องให้กรอกข้อมูลรวมถึงแนบหลักฐานหากข้อมูลไหนสามารถดึงมาจาก Active Entry Form  ได้เพื่อมา Auto-filled ก็ดึงมา Auto-Filled เลย และเมื่อเลือกหัวข้อคำร้องจะมีช่องให้กรอกข้อมูลใหม่ที่อยากเปลี่ยน (ถ้ามี)  
2. **Consent Logic:**  
   * *Case A:* ถ้านักแข่งSubmitเอง \-\> สถานะเปลี่ยนเป็น **`Pending`**อัตโนมัติ  
   * *Case B:* ถ้า Team Manager Submit \-\> สถานะเปลี่ยนเป็น **`Need Racer Approval`** อัตโนมัติ และระบบยิงแจ้งเตือนให้นักแข่งเข้ามากด Approve หากนักแข่งกด Reject เอกสารตีตกทันที หากกด Approve สถานะเอกสารจะกลายเป็น “Pending”

#### **Step 2: Secretary Initial Screening (การคัดกรองและกระจายงาน)**

1. Secretary/admin ได้รับแจ้งเตือนและเปิดดูคำร้องที่มีสถานะ “Pending” ที่นักแข่ง Approve แล้ว  
2. **Set Penalties:** Secretary ประเมินและระบุบทลงโทษเบื้องต้นในช่อง:  
   * `Fine Amount (ค่าปรับเงิน)`  
   * `Penalty Weight (น้ำหนักทำโทษ - kg)->ต้องนำไปคิดใน Weight-in Tab ด้วย`  
   * `ปรับกริดสตาร์ท (Grid Start)`  
3. **Dynamic Routing (การเลือกกรรมการ):** ใน หน้าใบคำร้องของSecretary จะมีปุ่ม Add Approval และจะมีรายชื่อคณะกรรมการให้เลือก Multiple-Choice  
   * เช่น ติ๊กเลือก `Clerk`, `President`, `Steward ให้มาช่วยดู`  
4. **Forwarding:** เมื่อ Secretary กด "Add Approval" ระบบจะยิงแจ้งเตือน (In-app/Email) ไปหากรรมการที่ถูกเลือก

#### **Step 3: Committee Evaluation (การลงความเห็นของกรรมการ)**

1. กรรมการที่ถูกเลือกได้รับการแจ้งเตือน  
2. เปิดเข้ามาดูคำร้อง (จะเห็นค่าปรับ/Penalty ที่ Secretary ตั้งไว้ด้วย)  
3. **Action:** กด **Approve** หรือ **Reject** พร้อมพิมพ์ **Comment**  
4. **Timestamp:** ระบบบันทึก Log วินาทีที่กด (เช่น `12-May-2026 14:05:33`)

#### **Step 4: The Final Verdict (การชี้ขาดโดยเลขาฯ)**

1. เมื่อกรรมการที่ถูกเลือกโหวตครบ (หรือหมดเวลาที่เลขาฯ กำหนด)  
2. Secretary กลับมาดูคำร้องใบนี้อีกครั้ง จะเห็น Dashboard สรุปผลโหวตและคอมเมนต์ของกรรมการทุกคน  
3. **Final Action:** Secretary กด **"Final Approve"** หรือ **"Final Reject"** พร้อมพิมพ์ Comment สรุปปิดคดี  
4. **Status Update:** สถานะเปลี่ยนเป็น **`Approved`** หรือ **`Rejected`** อย่างเป็นทางการ

#### **Step 5: Execution & Automation (ผลบังคับใช้แบบอัตโนมัติ)**

1. **Notification:** ระบบส่งแจ้งเตือนสรุปผล (พร้อมระบุยอดค่าปรับ/น้ำหนัก Penalty) กลับไปยัง Competitor และ Team Manager  
2. ข้อมูลจะไป Overwrite ข้อมูลเดิมที่ Active อยู่เลยอัตโนมัติ (ค่อยๆทำทีหลังด้วยกันอีกที)  
3. **Weight-in Integration:** หากในคำร้องนั้น Secretary มีการใส่ตัวเลข **Penalty Weight** ไว้ ระบบหลังบ้านจะนำค่านั้นไปบวกเป็น "Target Weight" ของรถคันนั้นในหน้า **Weight-in Tab** ของ Race ที่เกี่ยวข้องโดยอัตโนมัติ (สอดคล้องกับ PRD หน้า Weight-in)

#### **4.7.3 Roles & Permissions (สิทธิ์การเข้าถึงแบบละเอียด)**

* **Head Scrutineer / Scrutineer Staff / Off-Site Scrutineer Staff:** **\[Full Access\]** เห็น List Weight-in ของทุกคนและสามารถกรอก/แก้ไข Actual Weight ได้  
* **President / Steward / Clerk of the course:** **\[Read-Only\]** เห็น List Weight-in ของทุกคน  
* **Admin / Secretary:** **\[Read & Edit\]** เข้าถึงและแก้ไขข้อมูลได้ทั้งหมดในกรณีฉุกเฉิน  
* **Competitor / Team Manager:** **\[Read-Only\]** ดู List Weight-in ของ "รถตัวเอง/รถในสังกัด" ได้เท่านั้น เพื่อตรวจสอบว่าผ่านหรือไม่ หรือต้องแก้ไขจุดไหน

#### **4.7.4 UI/UX Requirements**

* เมื่อเข้ามาที่ Competitor Request Tab จะโชวในรูปแบบ List ที่ระบุ เบอร์รถ, วันเวลาที่สร้าง Form, วันเวลาที่อัพเดตล่าสุด, Request Topic, หมายเลข Queue Request ที่ส่งมาโดยจะเริ่มรันที่ 1 ใหม่ทุกๆ Event, Status ของเอกสาร, ปุ่ม Action button สำหรับ Row นั้นๆ เช่น View, Edit, Delete.  
* **Action Button:** ทุก Role จะสามารถเห็นปุ่ม View ได้, แต่กับเอกสารที่ไม่มีสถานะเป็น Draft ทุก Roles ยกเว้น Competitor และ Team manager จะไม่สามารถกด Edit, Delete ได้  
* เมื่อเข้ามาที่ Competitor Request Tab จะมีปุ่ม Create Competitor Form อยู่เมื่อกดแล้วจะ Popup Window เป็น Form ให้กรอก

#### 

### **4.8 Race Result Tab**

เพื่อบันทึกผลการแข่งขันอย่างเป็นทางการแบ่งตาม Series Race คำนวณคะแนนสะสม (Points) และที่สำคัญที่สุดคือการสรุป **"Success Ballast (น้ำหนักถ่วงความสำเร็จ)"** เพื่อส่งต่อข้อมูลไปยัง Tab Weight-In สำหรับการแข่งขันในเรซถัดไปหรืออีเวนต์ถัดไปอย่างถูกต้องแม่นยำ และเป็นหน้าในการโชวคะแนน published ให้นักแข่ง/Team Manager ดู

#### **4.8.1 การควบคุมสิทธิ์ (Roles & Permissions)**

* Admin หรือ Steward: นำเข้าผลการแข่งขันมากรอก Manual กดยืนยันเพื่อ Publish คะแนนซึ่งคะแนนเหล่านั้นจะเป็นแบบ Provision ก่อน ถ้าไม่ได้มีการ Official Sign-off  
* Role อื่นๆ จะสามารถ \[Read-only\] ตรวจสอบผลการแข่งได้ทันทีหลังจบการแข่ง

#### **4.8.2 กระบวนการทำงาน (Step-by-Step Workflow)**

#### **Step 1: Data Entry & Import (การนำเข้าข้อมูล)**

1. **Click Import Result**  
2. **Select Race:** เลือกเรซที่เพิ่งแข่งจบ (เช่น Event 1 \- Race 1\)  
3. **Import Action:** \* *Option A:* นำเข้าไฟล์ CSV จากระบบจับเวลา (ในอนาคต)  
   * *Option B:* กรอกมือทีละคันโดยพิมพ์เบอร์รถแล้วระบุอันดับ (ปัจจุบันต้องใช้วิธีนี้ก่อน)

#### **Step 2: Automated Calculation (การคำนวณคะแนนและน้ำหนัก)**

เมื่ออันดับนิ่งแล้วกดปุ่มคำนวณ ระบบจะคำนวณผลลัพธ์:

1. **Points:** คำนวณคะแนนอิงตามเกณฑ์คะแนนที่ Admin ตั้งไว้ใน Settings  
2. **Success Ballast:** คำนวณน้ำหนักถ่วงที่จะต้องใช้ใน **"เรซถัดไป"** \*  ตาม วิธีการคำนวณ Success Ballast
3. **Podium Tie-break Cache:** ตาราง `championship_standings` ต้องมีค่า cache `p1_count`, `p2_count` และ `p3_count` เพื่อใช้ตัดสินอันดับแชมป์ประจำปีกรณีคะแนนเท่ากัน โดยค่านี้ต้องถูกคำนวณจาก `race_result_entries` ที่เป็นผล Official/Locked เท่านั้น ห้าม Frontend คำนวณหรือส่งค่ามาเอง

#### **Step 3: Official Sign-off (การประกาศผลทางการ)**

1. **Verification:** Steward ตรวจสอบความถูกต้องขั้นสุดท้าย  
2. **Digital Signature:** Steward ลงลายเซ็นดิจิทัลเพื่อยืนยันผล  
3. **Locking:** ผลการแข่งถูกล็อค (Official Result) ห้ามแก้ไข

#### **Step 4: Data Propagation (การส่งต่อข้อมูล \- สำคัญมาก)**

ทันทีที่ผลการแข่งถูกล็อค ระบบจะทำการ:

1. **Sync to Weight-In:** ส่งค่า SuccessBallast  ที่ต้องถ่วงของแต่ละคันไปยังระบบคำนวณน้ำหนักของเรซถัดไปทันที  
2. **Public Leaderboard:** อัปเดตตารางคะแนนสะสม (Standing) ของทุกคนรวมถึงน้ำหนักถ่วงใน Race ถัดไปในหน้า Race Result และ คะแนนรวมถึงน้ำหนักถ่วงของตัวเองในหน้า Dashboard ของนักแข่งคนนั้นๆ
3. **Database-Owned Cache Sync:** ทุกครั้งที่มีการเพิ่ม/ลบ/แก้ไข `race_result_entries` หรือมีการเปลี่ยนสถานะผลแข่งเป็น/ออกจาก Official Database ต้อง Trigger คำนวณ `championship_standings.p1_count`, `championship_standings.p2_count` และ `championship_standings.p3_count` ใหม่ทันที เพื่อป้องกันกรณีแอดมินแก้ผลย้อนหลังแล้วอันดับแชมป์ประจำปีผิดพลาด

### 

### **4.9 Scrutineer Report (ระบบรายงานสรุปผลเทคนิคประจำเรซ)**

เพื่อสร้างเอกสารสรุปผลการตรวจสภาพและน้ำหนักรถแข่งหลังจบการแข่งขัน (Post-Race) ขนาด 1 หน้ากระดาษ A4 โดยระบบจะดึงข้อมูลอัตโนมัติมาแยกตาม Series และ Race เอกสารฉบับนี้คือ **"กุญแจสำคัญ (Interlock)"** สำหรับนายสนาม (Clerk of the course)

#### **4.9.1 การควบคุมสิทธิ์ (Roles & Permissions)**

* **Admin/Head Scrutineer:** เป็นผู้ที่สามารถกดสร้างรายงาน พิมพ์รายงานเพิ่มเติมในกรณีพิเศษ และลงลายเซ็นดิจิทัลเพื่อส่งมอบเอกสาร

#### **4.9.2 สถาปัตยกรรมข้อมูลและการดึงข้อมูลอัตโนมัติ (Auto-Fetch Data Architecture)**

รายงาน 1 ฉบับ จะผูกกับ Race และ `Grade ของนักแข่ง`โดยระบบจะดึงข้อมูลจาก 

1. **Inspection Form Tab** ดึงข้อมูลรถที่ผ่าน/ไม่ผ่านการตรวจสภาพของรถทุกคันใน Race นั้นๆ  
2. **Weight-In Tab:** ดึงผลรถที่ผ่าน/ไม่ผ่าน **Post-Race Weigh-in (การชั่งน้ำหนักหลังจบเรซ)** ของรถทุกคันใน​ Race นั้นๆ 

#### **4.9.3 กระบวนการทำงาน (Step-by-Step Workflow)**

#### **Step 1: Context Selection (การระบุขอบเขตรายงาน)**

1. Head Scrutineer เข้ามาที่ Tab: Scrutineer Report Tab ซึ่งจะโชว List ของ Scrutineer Report ทั้งหมด รวมถึง Status ของเอกสารในแต่ละ Row ในหน้านั้นยังมีปุ่ม Create Scrutineer Report  
2. Action Button บริเวณท้ายของแต่ละ Row จะมี ปุ่ม Edit, Delete หากสถานะเอกสารเป็น Draft อยู่ หากสถานะเอกสารเป็น Official จะมี Action Button แค่ View, Print  
3. เมื่อ กด Create Scrutineer Report จะเด้งเป็น Popup window ขึ้นมาเป็น Form สั้นๆ  
4. เลือก Dropdown: หัวข้อ `Event, หัวข้อ`  `Race`, หัวข้อ `Series,หัวข้อClass` (เช่น Event 1 \-\> Race 1 \-\> SIAM ECO \-\> Pro)  
5. กดปุ่ม **"Generate Report"**

#### **Step 2: Auto-Aggregation (ระบบจัดทำรายงานหน้า A4 อัตโนมัติ)**

ระบบจะสร้างหน้า UI ที่มีสัดส่วนเท่ากับกระดาษ A4 ขึ้นมาบนหน้าจอ โดยแบ่งข้อมูลเป็น 3 ส่วนหลัก:

* หัวข้อตามหัวข้อที่เลือก Event, Race, Series, Class  
* 🟢 **ส่วนที่ 1: รายชื่อรถที่ผ่าน (Passed Cars)**  
  * แสดงรายการเบอร์รถ ชื่อนักแข่ง ที่สถานะ Inspection \= Pass และ Weigh-in \= Pass (เช่น "รถหมายเลข 01, 09, 14, 88 \- ผ่านการตรวจสภาพและน้ำหนักครบถ้วน")  
* 🔴 **ส่วนที่ 2: รายชื่อรถที่ไม่ผ่าน / ถูกตัดสิทธิ์ (Failed / Disqualified Cars)**  
  * ดึงเบอร์รถที่ไม่ผ่าน พร้อม **"ดึงเหตุผลที่กรอกไว้ตอนตรวจ/ชั่งน้ำหนัก"** มาแสดงอัตโนมัติ  
  * *ตัวอย่าง:* "หมายเลข 99 \- น้ำหนักหลังแข่งไม่ผ่าน (ขาด 2 kg)" หรือ "หมายเลข 05 \- ไม่ผ่านการตรวจสภาพ (พบการดัดแปลงท่อไอดีผิดกติกา)"

#### **Step 3: Special Case / Re-check (กรณีสั่งรื้อตรวจพิเศษหรือ Remark ไว้)**

* ระบบจะมีกล่อง Text Area ขนาดใหญ่ให้ Head Scrutineer พิมพ์รายงานเพิ่มเติม  
* **Use Case:** กรณีที่ Clerk of Course หรือ Steward สั่งให้ "เปิดฝาสูบ" หรือ "ถอดเกียร์" รถคันที่ได้โพเดียมเพื่อเช็คสเปค Head Scrutineer จะพิมพ์บันทึกผลการตรวจพิเศษนี้ลงไป (เช่น *"ตามคำสั่งนายสนาม ได้ทำการรื้อตรวจวัดขนาดกระบอกสูบรถหมายเลข 11 ผลปรากฏว่าถูกต้องตามกติกา"*)

#### **Step 4: Sign-off & Unlock Race Result (การเซ็นรับรองและปลดล็อคระบบ)**

1. **Digital Signature:** Head Scrutineer ลงลายเซ็นดิจิทัลที่ท้ายรายงาน  
2. **Submit:** กดปุ่ม **"Publish Official Report"**  
3. **The Interlock System (สำคัญมาก):** \* เมื่อกด Submit สถานะรายงานจะเป็น **`Official`**  
   * ระบบจะยิง Trigger ไปปลดล็อค (Unlock) ปุ่ม Import Result ในแท็บ **Race Result** เพื่ออนุญาตให้ Admin กดPublishผลแข่ง provision ได้ (ถ้าใบนี้ยังไม่เซ็น แท็บ Race Result จะประกาศผลไม่ได้เด็ดขาด)

#### **Step 5: A4 Printing**

1. เมื่อสถานะเอกสารเป็น Official ตรง List ของ Scrutineer จะมีปุ่ม print ซึ่งเมื่อกดแล้วจะมีตัวเลือก เป็นรูป Backgound ให้เลือกว่าจะใช้ Background ไหน เมื่อยืนยันแล้วระบบจะใช้รูปที่เลือกเป็นพื้นหลังสำหรับ Print PDF

### **4.10 Organizer Settings Tab (Only Admin)**

เพื่อสร้าง Structure/Rule ของงานแข่งใน Season นั้นๆรวมถึง ให้ Admin สามารถกำหนดหัวข้อการตรวจเอกสาร, สร้างฟอร์มตรวจสภาพ, ตั้งค่าสมการน้ำหนัก (BOP & Ballast), ตารางคะแนน, ภาพพื้นหลังเอกสารเมื่อสั่งปริ้น, ภาพ Sticker Layout ของแต่ละรุ่นแต่ละปีและเส้นทางการส่งใบคำร้อง ได้อย่างยืดหยุ่น โดยระบบจะแปลงการตั้งค่าทั้งหมดแล้วนำไปแสดงผล/คำนวณใน Tab ที่เกี่ยวข้องแบบอัตโนมัติ

#### **4.10.1 กระบวนการทำงาน (Step-by-Step Workflow)**

หน้านี้จะถูกออกแบบมาในลักษณะเป็นรูปแบบ Cards และสามารถจัดการ Season ที่สร้างขึ้นมาได้ เมื่อคลิกเข้าไปใน Season Card ที่สร้างขึ้น จะเข้าไปหน้า ให้ตั้งค่าSeason และจัดการ Event ได้โดยจะแสดงเป็น List Eventเมื่อคลิกเข้าไปยัง Event ก็จะจัดการและโชว Race ที่มีใน Event นั้นๆ ในแต่ละ List Event จะมีปุ่มให้ Configure Event Rule เมื่อกดเข้าไปจะเป็น Sub-tabs หรือ Vertical Steps สำหรับ Set สิ่งต่างๆภายใน Event

### **Step 0: Initial Setting (ตั้งค่าSeason/Event/Race)**

1. Admin สร้างการแข่งขันปีนั้นๆ(Season)ขึ้น โดยกำหนดว่า Seasonนั้นจะมี Series Race อะไรบ้างแต่ละอันจะมี Grade นักแข่งอะไรบ้าง ใน 1 Seasonมีกี่ Event แต่ละEvent จัดแข่งที่สนามไหน, แต่ละ Event มีกี่ Race และ แต่ละ Event มีแบรนด์ยางอะไรที่ใช้แข่งขันได้บ้าง, อัพโหลดรูปพื้นหลังสำหรับเป็นตัวเลือกในการพิมพ์  
2. เมื่อสร้างเสร็จสถานะจะเป็น Draft ดังนั้น Admin ต้องกด Activate Season เพื่อนำ Config นั้นไปใช้  
3. สามารถ Clone Season หรือ Clone Event  และการตั้งค่าต่างๆจะถูกDuplicate มาด้วยได้เพื่อความรวดเร็วในการตั้งค่า  
4. Admin สามารถแก้ไข Configure Event Rule ที่ตั้งค่าไว้แล้วได้แม้จะยังไม่จบการแข่งขันแต่ต้องพิมพ์ Confirm เพื่อยืนยัน Action

### **Step 1: Context Selection (การเลือกรุ่นที่จะตั้งค่า)**

1. Admin เลือก `Season` \-\> กดปุ่ม Setting บริเวณ ที่ row ของ `Eventที่อยากตั้งค่า -> เลือกรุ่นการแข่งขันที่อยากตั้งค่า`  
2. ระบบจะโหลด `configs` ปัจจุบันของรุ่นการแข่งขันนั้นขึ้นมาให้แก้ไข (ถ้ายังไม่เคยตั้งค่า จะเป็นหน้าจอเริ่มต้นแบบเปล่าๆ)  
3. โดย Sub-tab ที่ให้ Configure จะมีดังนี้  
   1. Inspection Form Builder  
   2. Ballast Matrix  
   3. Point System  
   4. Sponsor Sticker

### 

### 

### **Step 2: ตั้งค่า Inspection Form Builder:**

**\-** เป็นการสร้าง Progressive Form ว่า Section 1 ควรเป็นอะไร Section ต่อไปเป็นอะไรและใน 1 Section ควรมี Item อะไรบ้างซึ่ง item นี้จะเป็นส่วนที่ให้ Competitor / Team Manager กรอก/ตื๊ก และ Scrutineer จะเป็นคนตรวจโดยมีปุ่ม Pass/Fail พร้อม comment ของแต่ละ Item

1. **Section (หมวดหมู่):** หมวดหมู่หลัก โดยปกติแล้วจะมีDefault คือ Driver, Car, Weight, `Safety&Equipment`, `Seal ซึ่งใน Progressive Form จะเป็น 1 Section = 1หน้า และ  Section Driver, Seal และ Car ไม่สามารถ customize subsection หรือเพิ่ม Item เองได้จะเป็นแบบ Fix ไว้เลยเพื่อให้ระบบสามารถดึงข้อมูลจาก Entry Form ของรถคันนั้นๆเข้ามา Auto-Filled ได้เลย`

**`Section Driver`**`: ชื่อนักแข่ง, ชื่อผู้จัดการทีม,เบอร์รถ, Series Race, แข่งใน Eventที่เท่าไหร, แข่งใน Season อะไร, สนามอะไร, ลงแข่ง grade อะไร` 

**`Section Car`**`:ยี่ห้อรถ, รุ่นรถ, ความจุเครื่อง, รหัทเครื่อง, Transmission, Drivetrain, Gearshift pattern,ยางที่มาร์คแล้วมีกี่เส้น ของBrand อะไรบ้าง, รูป Sponsor Sticker ที่ Admin ตั้งค่าไว้เพื่อเป็น Guideline ในการติด` 

**`Section Seal:`** `เป็นหน้าที่ให้ลงทะเบียน Seal ของ Engine และ Gear ซึ่ง 1 Engine / Gear สามารถมีได้สูงสุด 4 Seal` 

2. `Add Sub section:สามารถเพิ่ม Sub-Section ได้ภายใน Section นั้นๆเช่นใน Section Safety มี Sub-section คือ Racer Safety, Car light`  
3. **Add Items (หัวข้อย่อย):** ใส่รายการที่ต้องตรวจใน Sub-Section นั้นๆ  เช่น Roll Cage, Safety Belt  
4. **Define Input Type (สำคัญมาก\!):** Admin ต้องเลือกว่าแต่ละ Item ที่ตัวเองเพิ่มเข้ามานั้นจะแสดงเป็นรูปแบบไหน:  
   * `Check box: ความหมายคือ Have/Don’t Have`  
   * `Drop Down: มีตัวเลือกให้แต่ต้องเลือกได้แค่ตัวเลือกเดียว`  
   * `Text Input`: ให้กรรมการพิมพ์ข้อความ (เช่น "กรอกเลขซีลเครื่อง")

	และต้องเลือกว่าจะเพิ่มการคิดน้ำหนักที่ส่งผลต่อการคิด BOP เข้าไปในแต่ละ Item ที่ตัวเองเพิ่มขึ้นมาด้วยไหมเพื่อครอบคลุมตัวเลือกพิเศษที่ส่งผลต่อน้ำหนัก

* **None** ไม่ส่งผลต่อการคิดน้ำหนัก  
  * **Fix** จะ บังคับให้ Admin ใส่ค่า Weight (kg) กำกับไว้ด้วย (เช่น `+30`) เพื่อนำไปคำนวณใน BOP หากมีการเลือก Item นี้   
  * **Vary** จะสร้างช่องสำหรับให้ทีมตรวจสภาพเป็นคนใส่หน้างาน เพื่อนำไปคำนวณใน BOP หากมีการเลือก Item นี้ 

### 

### **Step 3: ตั้งค่า Ballast Matrix**

Admin กำหนดค่าในการคิด SuccessBallast:

1. **Success Ballast Rules:**  
   * **Max Ballast Cap:** น้ำหนักถ่วงสูงสุดที่ยอมรับได้ (เช่น `ห้ามเกิน 50 kg`)  
   * **Position Matrix:** ตั้งค่าถ่วงน้ำหนักตามอันดับในเรซก่อนหน้าว่าแต่ละอันดับจะโดนถ่วงกี่กิโลกรัมใน Race ถัดไป (เช่น ที่ 1 \= `+15 kg`, ที่ 2 \= `+10 kg`, ที่ 3 \= `+5 kg`)  
2. **Join Weight Toggle:** เปิด/ปิด ฟีเจอร์ *"คิดน้ำหนักถ่วง Max Class Ballast สำหรับนักแข่งที่เพิ่งมาลงแข่งครั้งแรกของปี (ยกเว้น Event 1)"* 

### **Step 4: ตั้งค่า Points System** 

Admin กำหนดคะแนนที่จะถูกส่งไปคำนวณในหน้า **Race Result**:

1. ระบุคะแนนตามอันดับที่เข้าเส้นชัย (เช่น ที่ 1 \= `25` คะแนน, ที่ 2 \= `18` คะแนน, ไปจนถึงอันดับที่ 15\)  
2. **Bonus Points:** เช่น `Pole Position = +2 คะแนน`, `Fastest Lap = +1 คะแนน`

### **Step 5: ตั้งค่า Sponsor Sticker**

1. Admin Upload รูป Sponsor Sticker Guidline 

### **Step 6: Review**

1. เป็นหน้าสุดท้ายที่จะเอาไว้เช็คข้อมูลทุกอย่างและเช็คว่าทุกส่วนนั้นได้มีการกรอกข้อมูลและมีการ Inspection หรือยัง  
2. เมื่อรีวิวเรียบร้อยและทุกข้อไม่มี Fail ก็จะสามารถสามารถกด Complete Inspection ได้

### 

### **Step 7: Validation & Immutable Lock (การล็อคความปลอดภัย)**

1. **The Safety Lock :** หาก Event นั้น มีสถานะ Active แล้วหากต้องแก้ไขจริงๆจะมีปุ่มให้แก้ไขได้เฉพาะ Admin แต่ต้องพิมพ์ Confirm เพื่อดำเนินการแก้ไข  
   * *เหตุผล:* ป้องกันไม่ให้ Admin มือลั่นไปแก้กติกาค่าน้ำหนักกลางอากาศ ซึ่งจะทำให้ผลคำนวณของรถที่ตรวจไปแล้วหรือแข่งไปแล้วพังทั้งระบบ 

#### 

#### 

#### 

#### **4.10.3 UI/UX Requirements**

* เป็นหน้าตั้งค่าที่เข้าใจง่าย เป็น Structure ที่ชัดเจน  
* **Preview Modeใน Inspection Form Builder:** มีปุ่ม "Preview" ให้ Admin ดูว่าฟอร์ม Inspection ที่ตั้งค่าเสร็จแล้ว พอไปโชว์บนหน้า iPad ของ Scrutineer จะมีหน้าตาอย่างไร  
* **Visual Cards:** แบ่งหมวดหมู่การตั้งค่าเป็น Card แยกกันชัดเจน เพื่อไม่ให้หน้าจอดูรกและยาวเกินไป


### **4.11. Multi-channel Notification System (ระบบแจ้งเตือนแบบพหุช่องทาง)**

เพื่อให้ผู้ใช้งาน (นักแข่ง, ผู้จัดการทีม, และกรรมการ) ได้รับทราบสถานะของเอกสารอย่างทันท่วงที โดยเฉพาะระหว่างการแข่งขัน ระบบจะใช้กลไกการแจ้งเตือน 2 ช่องทางหลัก คือ In-WebApp Notification และ Email Notification

#### **4.11.1. ช่องทางการแจ้งเตือน (Notification Channels)**

* **In-WebApp Notification (ระบบแจ้งเตือนในแอป):** \* ไอคอนกระดิ่ง (Bell Icon) บริเวณ Navigation Bar ซึ่งจะแสดงตัวเลขแจ้งเตือนที่ยังไม่ได้อ่าน (Unread Badge)  
  * ผู้ใช้งานสามารถคลิกที่ข้อความแจ้งเตือน เพื่อ Link ไปยังหน้าเอกสารที่เกี่ยวข้องได้ทันที (เช่น ลิงก์ไปหน้า Inspection เพื่อดูว่ารถไม่ผ่านจุดไหน)  
* **Email Notification (การแจ้งเตือนผ่านอีเมล):**  
  * ส่งข้อความสรุปสถานะไปยังอีเมลที่ลงทะเบียนไว้เพื่อเป็นหลักฐานลายลักษณ์อักษร (Formal Record) นอกระบบ

#### **4.11.2. เหตุการณ์สำคัญที่ต้องเกิดการแจ้งเตือน (Key Notification Triggers)**

ระบบจะทำการส่งแจ้งเตือนอัตโนมัติ เมื่อเกิดเหตุการณ์ดังต่อไปนี้แต่ไม่จำกัดเพียง (Event-Driven Triggers):

1. **Manager Invitation:** เมื่อนักแข่งส่งคำเชิญ (Invite) ให้ผู้จัดการทีม (ส่งผ่าน Email และ In-App)  
2. **Competitor Invitation:** เมื่อผู้จัดการทีมส่งคำเชิญให้นักแข่งเข้าร่วมทีม (ส่งผ่าน Email และ In-App)  
3. **Entry Form Status Update:** เมื่อ Secretary ทำการ `Approved` หรือ `Rejected` ใบสมัคร  
4. **Inspection Form Status Update** เมื่อสถานะนักแข่ง `Failed` (ไม่ผ่านการตรวจสภาพ) ระบบต้องรีบแจ้งเตือน Team Manager และ นักแข่ง ทันทีเพื่อให้แก้ไขข้อบกพร่อง  
5. **Competitor Request Status Update:**   
   * แจ้งเตือน Secretary เมื่อมีใบคำร้อง (`requests`) เข้ามาใหม่  
   * แจ้งเตือน Team Manager / นักแข่ง เมื่อใบคำร้องได้รับการ `Approved` หรือ `Rejected`  
6. **Weight In  Status Update**   
7. **Race Result Official Update**

### **4.12 Storage Retention Policy (V1)**

ใน V1 จะยังไม่มีระบบ Storage Garbage Collection สำหรับลบไฟล์จริงออกจาก Storage เพราะช่วงเริ่มต้นค่า Storage ของภาพเอกสารยังต่ำ และการลบไฟล์จริงเร็วเกินไปมีความเสี่ยงต่อหลักฐานการแข่งขันและ Audit Trail ดังนั้นระบบจะใช้ Soft Delete ในตาราง `file_assets` โดยเพิ่ม `deleted_at` และ `deleted_by_id` เพื่อซ่อนไฟล์จากผู้ใช้เท่านั้น ไฟล์จริงจะยังคงอยู่ใน Storage จนกว่าระบบเสถียร 100% แล้วค่อยเพิ่ม Script กวาดขยะภายหลัง
