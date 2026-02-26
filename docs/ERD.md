# ERD - نظام قسمة غرماء الديون

```mermaid
erDiagram
    Department ||--o{ User : has
    Department ||--o{ Debtor : owns
    Department ||--o{ Distribution : scopes
    Department ||--o{ Notification : issues

    Debtor ||--o{ Distribution : includes
    Distribution ||--o{ Creditor : contains
    Distribution ||--o{ Notification : references

    User ||--o{ AuditLog : records

    Department {
        bigint id PK
        varchar code UK
        varchar name UK
        bool is_active
    }

    User {
        bigint id PK
        varchar username UK
        varchar role
        bigint department_id FK
        bool is_active
    }

    Debtor {
        bigint id PK
        varchar full_name
        varchar civil_id UK
        bigint department_id FK
    }

    Distribution {
        bigint id PK
        bigint debtor_id FK
        bigint department_id FK
        varchar distribution_type
        decimal proceed_amount
        varchar machine_number
        date distribution_date
        varchar list_type
    }

    Creditor {
        bigint id PK
        bigint distribution_id FK
        varchar machine_number
        varchar creditor_name
        date attachment_date
        decimal debt_amount
        int debt_rank
        decimal distribution_amount
    }

    Notification {
        bigint id PK
        bigint distribution_id FK
        bigint department_id FK
        date attendance_date
        time attendance_time
        varchar location
        varchar floor
        varchar room_number
    }

    AuditLog {
        bigint id PK
        bigint user_id FK
        varchar action
        varchar model_name
        varchar object_id
        json details
        datetime created_at
    }
```

## فهارس وقيود أساسية
- Unique: `Department(code,name)`, `Debtor(civil_id)`, `Distribution(department,machine_number)`
- Indexes: البحث على `civil_id`, `machine_number`, `distribution_date`, `department`
- Constraints: تحقق Regex للرقم المدني 12 رقم، والرقم الآلي 9 أرقام وينتهي بصفر.
