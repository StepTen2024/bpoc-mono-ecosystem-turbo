'use client';

import React from 'react';
import { Settings, User, Bell, Shield, Database, Mail, Globe, Key } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/shared/ui/card';
import { Button } from '@/components/shared/ui/button';
import Link from 'next/link';

export default function SettingsPage() {
  const settingsSections = [
    {
      title: 'SEO & Organization Schema',
      description: 'Manage global SEO settings and organization data',
      icon: Globe,
      color: 'cyan',
      href: '/settings/seo',
    },
    {
      title: 'Profile Settings',
      description: 'Manage your admin account',
      icon: User,
      color: 'purple',
    },
    {
      title: 'Notifications',
      description: 'Configure alerts and emails',
      icon: Bell,
      color: 'emerald',
    },
    {
      title: 'Security',
      description: 'Password and authentication',
      icon: Shield,
      color: 'orange',
    },
    {
      title: 'Database',
      description: 'Backups and maintenance',
      icon: Database,
      color: 'red',
    },
    {
      title: 'Email Templates',
      description: 'Customize system emails',
      icon: Mail,
      color: 'cyan',
    },
    {
      title: 'API Keys',
      description: 'Manage external integrations',
      icon: Key,
      color: 'purple',
    },
  ];

  const colorClasses: Record<string, string> = {
    cyan: 'bg-cyan-500/20 text-cyan-400',
    purple: 'bg-purple-500/20 text-purple-400',
    emerald: 'bg-emerald-500/20 text-emerald-400',
    orange: 'bg-orange-500/20 text-orange-400',
    red: 'bg-red-500/20 text-red-400',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 mt-1">Manage platform configuration</p>
      </div>

      {/* Settings Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {settingsSections.map((section) => {
          const cardContent = (
            <Card
              className="bg-white/5 border-white/10 hover:border-red-500/30 transition-all cursor-pointer group h-full"
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${colorClasses[section.color]}`}>
                    <section.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold group-hover:text-red-400 transition-colors">
                      {section.title}
                    </h3>
                    <p className="text-gray-400 text-sm mt-1">{section.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );

          return section.href ? (
            <Link key={section.title} href={section.href}>
              {cardContent}
            </Link>
          ) : (
            <div key={section.title}>
              {cardContent}
            </div>
          );
        })}
      </div>

      {/* Quick Settings */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Quick Settings</CardTitle>
          <CardDescription className="text-gray-400">Common configuration options</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-white/5">
            <div>
              <p className="text-white font-medium">Maintenance Mode</p>
              <p className="text-gray-400 text-sm">Temporarily disable public access</p>
            </div>
            <Button variant="outline" className="border-white/10">
              Disabled
            </Button>
          </div>
          <div className="flex items-center justify-between p-4 rounded-lg bg-white/5">
            <div>
              <p className="text-white font-medium">New User Registration</p>
              <p className="text-gray-400 text-sm">Allow new accounts to be created</p>
            </div>
            <Button variant="outline" className="border-emerald-500/30 text-emerald-400">
              Enabled
            </Button>
          </div>
          <div className="flex items-center justify-between p-4 rounded-lg bg-white/5">
            <div>
              <p className="text-white font-medium">Job Auto-Approval</p>
              <p className="text-gray-400 text-sm">Automatically approve new job postings</p>
            </div>
            <Button variant="outline" className="border-white/10">
              Disabled
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

