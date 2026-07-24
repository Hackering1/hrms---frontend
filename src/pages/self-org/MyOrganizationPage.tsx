import { useState } from "react";
import { ConfigProvider, Typography, Tabs } from "antd";
import {
  BankOutlined,
  ApartmentOutlined,
  IdcardOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import MyOrgRecord, { yesNo } from "./MyOrgRecord";

const { Title, Text } = Typography;

const theme = {
  token: {
    colorPrimary: "#0d9488",
    borderRadius: 10,
    fontFamily: "Inter, system-ui, sans-serif",
  },
};

export default function MyOrganizationPage() {
  const [tab, setTab] = useState("branch");

  const items = [
    {
      key: "branch",
      label: (
        <span>
          <BankOutlined /> Branch
        </span>
      ),
      children: (
        <MyOrgRecord
          hideHeader
          title="My Branch"
          subtitle="The branch you're assigned to."
          endpoint="/branches"
          queryKey="branches"
          idField="branchId"
          emptyText="You haven't been assigned to a branch yet."
          fields={[
            { key: "name", label: "Branch Name" },
            { key: "code", label: "Code" },
            { key: "address", label: "Address" },
            { key: "city", label: "City" },
            { key: "state", label: "State" },
            { key: "country", label: "Country" },
            { key: "pincode", label: "Pincode" },
            { key: "isActive", label: "Active", format: yesNo },
          ]}
        />
      ),
    },
    {
      key: "department",
      label: (
        <span>
          <ApartmentOutlined /> Department
        </span>
      ),
      children: (
        <MyOrgRecord
          hideHeader
          title="My Department"
          subtitle="The department you belong to."
          endpoint="/departments"
          queryKey="departments"
          idField="departmentId"
          emptyText="You haven't been assigned to a department yet."
          fields={[
            { key: "name", label: "Department Name" },
            { key: "code", label: "Code" },
            { key: "description", label: "Description" },
            { key: "isActive", label: "Active", format: yesNo },
          ]}
        />
      ),
    },
    {
      key: "designation",
      label: (
        <span>
          <IdcardOutlined /> Designation
        </span>
      ),
      children: (
        <MyOrgRecord
          hideHeader
          title="My Designation"
          subtitle="Your role / designation."
          endpoint="/designations"
          queryKey="designations"
          idField="designationId"
          emptyText="You haven't been assigned a designation yet."
          fields={[
            { key: "name", label: "Designation" },
            { key: "code", label: "Code" },
            { key: "level", label: "Level" },
            { key: "isActive", label: "Active", format: yesNo },
          ]}
        />
      ),
    },
    {
      key: "shift",
      label: (
        <span>
          <ClockCircleOutlined /> Shift
        </span>
      ),
      children: (
        <MyOrgRecord
          hideHeader
          title="My Shift"
          subtitle="Your working shift timings."
          endpoint="/shifts"
          queryKey="shifts"
          idField="shiftId"
          emptyText="You haven't been assigned a shift yet."
          fields={[
            { key: "name", label: "Shift Name" },
            { key: "startTime", label: "Start Time" },
            { key: "endTime", label: "End Time" },
            { key: "graceMinutes", label: "Grace (minutes)" },
            { key: "isNightShift", label: "Night Shift", format: yesNo },
            { key: "isActive", label: "Active", format: yesNo },
          ]}
        />
      ),
    },
  ];

  return (
    <ConfigProvider theme={theme}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>
            My Organization
          </Title>
          <Text type="secondary">
            Your branch, department, designation and shift details.
          </Text>
        </div>
        <Tabs activeKey={tab} onChange={setTab} items={items} />
      </div>
    </ConfigProvider>
  );
}
